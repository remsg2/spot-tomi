/**
 * Logique de l'Edge Function publish-spot (spécifications 6.1, contrats §4),
 * séparée du runtime : les accès à Supabase et au géocodeur sont injectés,
 * ce qui permet de la tester sous Vitest (voir handler.test.ts).
 */
import {
  isOwnPhotoPath,
  MAX_PHOTO_BYTES,
  publishInputSchema,
  replacePhotoSchema,
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
  p_year: number | null;
  p_comment: string | null;
  p_tourist: boolean;
  p_thumb_path: string | null;
  p_altitude_source: "exif" | "dem" | null;
  p_photo_hash: string | null;
};

export type CreateSpotOutcome = { id: string } | { sqlCode: string; message: string };

export type ReplacePhotoArgs = {
  p_author: string;
  p_spot_id: string;
  p_photo_path: string;
  p_thumb_path: string | null;
  p_photo_hash: string | null;
};

export type ReplacePhotoOutcome =
  | { oldPhotoPath: string | null; oldThumbPath: string | null }
  | { sqlCode: string; message: string };

export type PublishDeps = {
  /** Identifiant de l'utilisateur du jeton (auth.getUser), ou null. */
  getUserId(token: string): Promise<string | null>;
  /** Contenu de spot-photos/{path}, ou null s'il n'existe pas. */
  downloadPhoto(path: string): Promise<Uint8Array | null>;
  removePhoto(path: string): Promise<void>;
  /** Ville du point et site touristique à proximité (ne doit pas lever). */
  geocode(lat: number, lng: number): Promise<{ city: string | null; tourist: boolean }>;
  /** Altitude du terrain, ou null (ne doit pas lever). */
  elevation(lat: number, lng: number): Promise<number | null>;
  createSpot(args: CreateSpotArgs): Promise<CreateSpotOutcome>;
  replacePhoto(args: ReplacePhotoArgs): Promise<ReplacePhotoOutcome>;
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
  edition_unavailable: "Cette édition n'est pas disponible.",
  invalid_date: "Date du collage invalide.",
  edit_window: "Le délai de modification est dépassé.",
  not_found: "Sticker introuvable.",
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

/**
 * Photo (et miniature) stockées : WebP d'image fixe, sans aucune métadonnée. Un fichier
 * refusé est supprimé ; renvoie la réponse d'erreur, ou null si tout est conforme.
 */
async function checkStoredPhotos(paths: string[], deps: PublishDeps): Promise<Response | null> {
  for (const path of paths) {
    const bytes = await deps.downloadPhoto(path);
    if (!bytes) return fail("photo_missing", 400);
    const removeAll = () => Promise.all(paths.map((p) => quietly(deps.removePhoto(p), undefined)));
    if (bytes.length > MAX_PHOTO_BYTES) {
      await removeAll();
      return fail("photo_invalid", 422);
    }
    const inspection = inspectWebp(bytes);
    if (inspection.metadata.length > 0) {
      await removeAll();
      deps.log?.("photo refusée : métadonnées", inspection.metadata);
      return fail("photo_metadata", 422);
    }
    if (inspection.problems.length > 0) {
      await removeAll();
      deps.log?.("photo refusée : WebP invalide", inspection.problems);
      return fail("photo_invalid", 422);
    }
  }
  return null;
}

/** Nouvelle photo d'un sticker par son auteur (dans le délai de modification). */
async function handleReplacePhoto(body: unknown, userId: string, deps: PublishDeps): Promise<Response> {
  const parsed = replacePhotoSchema.safeParse(body);
  if (!parsed.success) return fail("invalid_input", 400);
  const input = parsed.data;
  if (!isOwnPhotoPath(input.photoPath, userId)) return fail("invalid_input", 400, "La photo doit être dans ton dossier.");
  const paths = input.thumbPath ? [input.photoPath, input.thumbPath] : [input.photoPath];
  const refused = await checkStoredPhotos(paths, deps);
  if (refused) return refused;

  const replaced = await deps.replacePhoto({
    p_author: userId,
    p_spot_id: input.replaceSpotId,
    p_photo_path: input.photoPath,
    p_thumb_path: input.thumbPath,
    p_photo_hash: input.photoHash,
  });
  if ("sqlCode" in replaced) {
    await Promise.all(paths.map((p) => quietly(deps.removePhoto(p), undefined)));
    const known = SQL_ERRORS[replaced.sqlCode];
    if (known) return fail(known.code, known.status, replaced.message || MESSAGES[known.code]);
    deps.log?.("replace_spot_photo a échoué", replaced);
    return fail("server_error", 500);
  }
  // Les anciens fichiers ne servent plus : supprimés sans bloquer la réponse.
  const old = [replaced.oldPhotoPath, replaced.oldThumbPath].filter((p): p is string => Boolean(p));
  await Promise.all(old.map((p) => quietly(deps.removePhoto(p), undefined)));
  return json({ replaced: true, photoPath: input.photoPath, thumbPath: input.thumbPath }, 200);
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
    if (typeof body === "object" && body !== null && "replaceSpotId" in body) {
      return await handleReplacePhoto(body, userId, deps);
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

    // 3. Photo et miniature stockées : WebP d'image fixe, sans aucune métadonnée.
    const files = input.thumbPath ? [input.photoPath, input.thumbPath] : [input.photoPath];
    const refused = await checkStoredPhotos(files, deps);
    if (refused) return refused;

    // 4. Rang avant ; ville, site touristique et altitude du terrain (non bloquants) ;
    //    création et calcul des points.
    const rankBefore = await quietly(deps.currentRank(userId), null);
    const [place, terrain] = await Promise.all([
      quietly(deps.geocode(input.lat, input.lng), { city: null, tourist: false }),
      // Altitude GPS de la photo si elle existe, sinon celle du terrain (jamais inventée).
      input.altitude === null ? quietly(deps.elevation(input.lat, input.lng), null) : Promise.resolve(null),
    ]);
    const altitude = input.altitude ?? terrain;

    const created = await deps.createSpot({
      p_author: userId,
      p_name: input.name,
      p_lat: input.lat,
      p_lng: input.lng,
      p_altitude_m: altitude,
      // Date de la photo ou date saisie ; « device » et « upload » prennent l'heure du serveur.
      p_taken_at: input.dateSource === "exif" || input.dateSource === "manual" ? input.takenAt : null,
      p_gps_source: input.gpsSource,
      p_date_source: input.dateSource,
      p_photo_path: input.photoPath,
      p_city: place.city,
      p_year: input.year,
      p_comment: input.comment,
      p_tourist: place.tourist,
      p_thumb_path: input.thumbPath,
      p_altitude_source: input.altitude !== null ? "exif" : terrain !== null ? "dem" : null,
      p_photo_hash: input.photoHash,
    });

    if (!("id" in created)) {
      const known = SQL_ERRORS[created.sqlCode];
      // La photo ne sert à rien si le sticker est refusé (sauf si elle appartient déjà à un sticker).
      if (known?.code !== "photo_reused") {
        await Promise.all(files.map((p) => quietly(deps.removePhoto(p), undefined)));
      }
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
