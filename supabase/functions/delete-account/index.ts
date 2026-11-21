// Suppression définitive d'un compte (spécifications 2.1 ; cahier des charges 11).
//
// - Sans corps (ou sans userId) : le compte de l'utilisateur connecté.
// - { userId, reason } : le compte d'un autre membre, par un admin. La base vérifie
//   le rôle, le motif et la règle « pas un admin » (record_admin_account_deletion),
//   et journalise l'action avant toute suppression.
//
// Puis : fichiers Storage (avatars, photos de stickers et miniatures), et compte Auth :
// profil, stickers, journal de points, badges et likes suivent en cascade.
// La clé service ne quitte jamais cette fonction.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKETS = ["avatars", "spot-photos"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Clé service : variable historique, sinon nouvelles clés secrètes (JSON). */
function serviceKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  const key = keys.default ?? Object.values(keys)[0];
  if (!key) throw new Error("Clé service introuvable");
  return key;
}

/** Vide le dossier {userId}/ d'un bucket (par lots de 100). Bucket absent : rien à faire. */
async function removeFolder(admin: SupabaseClient, bucket: string, userId: string): Promise<void> {
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(userId, { limit: 100 });
    if (error) {
      if (/not found/i.test(error.message)) return;
      throw error;
    }
    if (!data || data.length === 0) return;
    const { error: removeError } = await admin.storage
      .from(bucket)
      .remove(data.map((file) => `${userId}/${file.name}`));
    if (removeError) throw removeError;
  }
}

/** Messages des refus de record_admin_account_deletion (codes SQL). */
const ADMIN_ERRORS: Record<string, [number, string]> = {
  "42501": [403, "Action réservée aux admins."],
  ST803: [400, "Supprime ton propre compte depuis tes réglages."],
  ST012: [409, "Retire d'abord le rôle admin de ce compte."],
  "22023": [400, "Motif obligatoire (3 à 200 caractères)."],
  P0002: [404, "Utilisateur introuvable."],
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Connexion requise" }, 401);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: "Session invalide" }, 401);
    const callerId = data.user.id;

    const body = (await request.json().catch(() => ({}))) as { userId?: unknown; reason?: unknown };
    let userId = callerId;
    let username: string | undefined;
    if (typeof body.userId === "string" && body.userId !== callerId) {
      if (!UUID.test(body.userId)) return json({ error: "Utilisateur invalide" }, 400);
      const { data: recorded, error: refused } = await admin.rpc("record_admin_account_deletion", {
        p_actor: callerId,
        p_user: body.userId,
        p_reason: typeof body.reason === "string" ? body.reason : "",
      });
      if (refused) {
        const [status, message] = ADMIN_ERRORS[refused.code ?? ""] ?? [500, "Suppression impossible"];
        return json({ error: message }, status);
      }
      userId = body.userId;
      username = (recorded as { username?: string } | null)?.username;
    }

    for (const bucket of BUCKETS) await removeFolder(admin, bucket, userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ deleted: true, username });
  } catch (error) {
    console.error("delete-account", error);
    return json({ error: "Suppression impossible" }, 500);
  }
});
