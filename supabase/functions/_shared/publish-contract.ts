/**
 * Contrat de la publication d'un sticker (docs/contrats.md §4), partagé par
 * le client Next.js (formulaire, appel) et l'Edge Function publish-spot
 * (validation de l'entrée). Seule dépendance : zod (import map côté Deno).
 *
 * Pas de texte d'interface ici : les erreurs de formulaire sont des codes,
 * traduits par src/i18n/publish.fr.ts.
 */
import { z } from "zod";

export const PHOTO_BUCKET = "spot-photos";
/** Photo d'origine acceptée (JPEG, HEIC, PNG) : 20 Mo maximum. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
/** Plus grand côté de la photo réencodée. */
export const MAX_PHOTO_SIDE = 2048;
export const PLACE_NAME_MAX = 80;
/** Déplacement maximal d'une position GPS (scoring_rules.edit_radius_m). */
export const DEFAULT_EDIT_RADIUS_M = 200;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** spot-photos/{user_id}/{uuid}.webp (chemin dans le bucket, sans son nom). */
export const PHOTO_PATH_PATTERN = new RegExp(`^(${UUID})/${UUID}\\.webp$`);

export function photoPathFor(userId: string, fileId: string): string {
  return `${userId}/${fileId}.webp`;
}

/** Le chemin est-il dans le dossier de cet utilisateur ? */
export function isOwnPhotoPath(path: string, userId: string): boolean {
  const match = PHOTO_PATH_PATTERN.exec(path);
  return match !== null && match[1] === userId.toLowerCase();
}

/** Espaces multiples réduits, comme le fait create_spot. */
export function normalizePlaceName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export const placeNameSchema = z
  .string()
  .transform(normalizePlaceName)
  .pipe(
    z
      .string()
      .min(1, { error: "name_required" })
      .max(PLACE_NAME_MAX, { error: "name_too_long" }),
  );

export const gpsSourceSchema = z.enum(["exif", "manual"]);
export const dateSourceSchema = z.enum(["exif", "upload"]);
export type GpsSource = z.infer<typeof gpsSourceSchema>;
export type DateSource = z.infer<typeof dateSourceSchema>;

/** Entrée de l'Edge Function publish-spot. */
export const publishInputSchema = z
  .object({
    photoPath: z.string().regex(PHOTO_PATH_PATTERN),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    altitude: z.number().min(-500).max(9000).nullish().transform((value) => value ?? null),
    takenAt: z.iso.datetime({ offset: true }).nullish().transform((value) => value ?? null),
    gpsSource: gpsSourceSchema,
    dateSource: dateSourceSchema,
    name: placeNameSchema,
  })
  .refine((input) => input.dateSource === "upload" || input.takenAt !== null, {
    error: "taken_at_required",
    path: ["takenAt"],
  });

export type PublishInput = z.input<typeof publishInputSchema>;
export type PublishInputParsed = z.output<typeof publishInputSchema>;

export const spotStatusSchema = z.enum(["published", "pending_review", "hidden"]);
export type SpotStatus = z.infer<typeof spotStatusSchema>;

export const pointLineSchema = z.object({
  ruleKey: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  points: z.number().int(),
});
export type PublishedPointLine = z.infer<typeof pointLineSchema>;

/** Sortie de l'Edge Function publish-spot. */
export const publishResultSchema = z.object({
  spot: z.object({
    id: z.string(),
    name: z.string(),
    city: z.string().nullable(),
    countryNameFr: z.string().nullable(),
    year: z.number().int(),
    colorHex: z.string(),
    status: spotStatusSchema,
    pointsTotal: z.number().int(),
    isFirstInCountry: z.boolean(),
    isExceptional: z.boolean(),
  }),
  lines: z.array(pointLineSchema),
  rank: z.object({
    before: z.number().int().nullable(),
    after: z.number().int().nullable(),
  }),
});
export type PublishResult = z.infer<typeof publishResultSchema>;

/** Sortie de public.estimate_spot_points (jsonb). */
export const estimateSchema = z.object({
  pointsTotal: z.number().int(),
  status: spotStatusSchema,
  year: z.number().int(),
  colorHex: z.string(),
  countryIso2: z.string().nullable(),
  countryNameFr: z.string().nullable(),
  isFirstInCountry: z.boolean(),
  blocked: z.enum(["daily_limit", "nearby_today"]).nullable(),
  lines: z.array(pointLineSchema),
});
export type Estimate = z.infer<typeof estimateSchema>;

/** Codes d'erreur renvoyés par publish-spot : `{ error: { code, message } }`. */
export const PUBLISH_ERROR_CODES = [
  "unauthorized",
  "method_not_allowed",
  "invalid_input",
  "photo_missing",
  "photo_invalid",
  "photo_metadata",
  "photo_reused",
  "missing_profile",
  "suspended",
  "daily_limit",
  "nearby_today",
  "server_error",
] as const;
export type PublishErrorCode = (typeof PUBLISH_ERROR_CODES)[number];

export const publishErrorSchema = z.object({
  error: z.object({ code: z.enum(PUBLISH_ERROR_CODES), message: z.string() }),
});

/** Erreurs SQL de create_spot / estimate_spot_points → code et statut HTTP. */
export const SQL_ERRORS: Record<string, { code: PublishErrorCode; status: number }> = {
  "28000": { code: "unauthorized", status: 401 },
  ST001: { code: "missing_profile", status: 403 },
  ST002: { code: "suspended", status: 403 },
  ST003: { code: "daily_limit", status: 429 },
  ST004: { code: "nearby_today", status: 409 },
  ST005: { code: "invalid_input", status: 400 },
  ST006: { code: "photo_reused", status: 409 },
};
