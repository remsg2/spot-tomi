/**
 * Logique de l'Edge Function publish-spot (spécifications 6.1, contrats §4),
 * séparée du runtime : les accès à Supabase et au géocodeur sont injectés,
 * ce qui permet de la tester sous Vitest (voir handler.test.ts).
 */
import {
  isOwnPhotoPath,
  MAX_PHOTO_BYTES,
  publishInputSchema,
  SQL_ERRORS,
  type PublishErrorCode,
  type PublishInputParsed,
  type PublishResult,
} from "../_shared/publish-contract.ts";
import { inspectWebp } from "../_shared/webp-metadata.ts";

export type CreateSpotArgs = {
  p_author: string;
  p_name: string;
  p_lat: number;
  p_lng: number;
  p_altitude_m: number | null;
  p_taken_at: string | null;
  p_gps_source: PublishInputParsed["gpsSource"];
  p_date_source: PublishInputParsed["dateSource"];
  p_photo_path: string;
  p_city: string | null;
};

export type CreateSpotOutcome = { id: string } | { sqlCode: string; message: string };

export type PublishDeps = {
  /** Identifiant de l'utilisateur du jeton (auth.getUser), ou null. */
  getUserId(token: string): Promise<string | null>;
  /** Contenu de spot-photos/{path}, ou null s'il n'existe pas. */
  downloadPhoto(path: string): Promise<Uint8Array | null>;
  removePhoto(path: string): Promise<void>;
  /** Ville du point, ou null (ne doit pas lever). */
  geocodeCity(lat: number, lng: number): Promise<string | null>;
  createSpot(args: CreateSpotArgs): Promise<CreateSpotOutcome>;
  /** Sticker créé et détail de ses points, au format de la réponse. */
  loadSpot(id: string): Promise<Pick<PublishResult, "spot" | "lines">>;
  /** Rang (points) de l'utilisateur au classement de l'année, ou null (vue absente, non classé). */
  currentRank(userId: string): Promise<number | null>;
  refreshLeaderboard(): Promise<void>;
  log?(message: string, details?: unknown): void;
};

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const MESSAGES: Record<PublishErrorCode, string> = {
  unauthorized: "Connexion requise.",
  method_not_allowed: "Méthode non autorisée.",
  invalid_input: "Données de publication invalides.",
  photo_missing: "Photo introuvable : envoie-la d'abord.",
  photo_invalid: "La photo n'est pas une image WebP valide.",
  photo_metadata: "La photo contient encore des métadonnées (EXIF, XMP ou ICC) : elle a été supprimée.",
  photo_reused: "Cette photo a déjà été publiée.",
  missing_profile: "Choisis d'abord ton pseudo pour publier un sticker.",
  suspended: "Ton compte est suspendu : tu ne peux plus publier de sticker.",
  daily_limit: "Tu as atteint la limite de publications des dernières 24 heures.",
  nearby_today: "Tu as déjà collé un sticker à moins de 200 m d'ici aujourd'hui.",
  server_error: "Erreur du serveur. Réessaie dans un instant.",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function fail(code: PublishErrorCode, status: number, message = MESSAGES[code]): Response {
  return json({ error: { code, message } }, status);
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

async function quietly<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export async function handlePublishRequest(request: Request, deps: PublishDeps): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") return fail("method_not_allowed", 405);

  try {
    // 1. Identité : le jeton de l'utilisateur, vérifié par Supabase Auth.
    const token = bearerToken(request);
    const userId = token ? await deps.getUserId(token) : null;
    if (!userId) return fail("unauthorized", 401);

    // 2. Entrée (schéma partagé avec le client).
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("invalid_input", 400);
    }
    const parsed = publishInputSchema.safeParse(body);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ");
      return fail("invalid_input", 400, `${MESSAGES.invalid_input} (${fields})`);
    }
    const input = parsed.data;
    if (!isOwnPhotoPath(input.photoPath, userId)) {
      return fail("invalid_input", 400, "La photo doit être dans ton dossier.");
    }

    // 3. Photo stockée : WebP d'image fixe, sans aucune métadonnée.
    const bytes = await deps.downloadPhoto(input.photoPath);
    if (!bytes) return fail("photo_missing", 400);
    if (bytes.length > MAX_PHOTO_BYTES) {
      await quietly(deps.removePhoto(input.photoPath), undefined);
      return fail("photo_invalid", 422);
    }
    const inspection = inspectWebp(bytes);
    if (inspection.metadata.length > 0) {
      await quietly(deps.removePhoto(input.photoPath), undefined);
      deps.log?.("photo refusée : métadonnées", inspection.metadata);
      return fail("photo_metadata", 422);
    }
    if (inspection.problems.length > 0) {
      await quietly(deps.removePhoto(input.photoPath), undefined);
      deps.log?.("photo refusée : WebP invalide", inspection.problems);
      return fail("photo_invalid", 422);
    }

    // 4. Rang avant, ville (non bloquant), création et calcul des points.
    const rankBefore = await quietly(deps.currentRank(userId), null);
    const city = await quietly(deps.geocodeCity(input.lat, input.lng), null);

    const created = await deps.createSpot({
      p_author: userId,
      p_name: input.name,
      p_lat: input.lat,
      p_lng: input.lng,
      p_altitude_m: input.altitude,
      p_taken_at: input.dateSource === "upload" ? null : input.takenAt,
      p_gps_source: input.gpsSource,
      p_date_source: input.dateSource,
      p_photo_path: input.photoPath,
      p_city: city,
    });

    if (!("id" in created)) {
      const known = SQL_ERRORS[created.sqlCode];
      // La photo ne sert à rien si le sticker est refusé (sauf si elle appartient déjà à un sticker).
      if (known?.code !== "photo_reused") await quietly(deps.removePhoto(input.photoPath), undefined);
      if (known) return fail(known.code, known.status, created.message || MESSAGES[known.code]);
      deps.log?.("create_spot a échoué", created);
      return fail("server_error", 500);
    }

    const { spot, lines } = await deps.loadSpot(created.id);

    // 5. Classement : seuls les stickers publiés comptent.
    let rankAfter = rankBefore;
    if (spot.status === "published") {
      await quietly(deps.refreshLeaderboard(), undefined);
      rankAfter = await quietly(deps.currentRank(userId), null);
    }

    const result: PublishResult = { spot, lines, rank: { before: rankBefore, after: rankAfter } };
    return json(result, 200);
  } catch (error) {
    deps.log?.("publish-spot : erreur inattendue", error instanceof Error ? error.message : error);
    return fail("server_error", 500);
  }
}
