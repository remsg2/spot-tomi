// Suppression définitive du compte de l'utilisateur connecté (spécifications, 2.1).
//
// 1. Vérifie le jeton de l'utilisateur.
// 2. Supprime ses fichiers Storage (avatars, photos de stickers).
// 3. Supprime le compte Auth : profil, domicile et stickers partent en cascade.
//
// La clé service ne quitte jamais cette fonction.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKETS = ["avatars", "spot-photos"];

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
    const userId = data.user.id;

    for (const bucket of BUCKETS) await removeFolder(admin, bucket, userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (error) {
    console.error("delete-account", error);
    return json({ error: "Suppression impossible" }, 500);
  }
});
