import { z } from "zod";
import { ta } from "@/i18n/admin.fr";
import { BAND_COLOR, contrastRatio, MIN_CONTRAST } from "@/lib/design/color";

/*
 * Validation des formulaires de l'admin, partagée par le client (retour
 * immédiat) et les Server Actions (qui ne font jamais confiance au client).
 * La base revérifie tout (supabase/migrations/20261126000000_admin.sql).
 */

export const SEASON_YEAR_MIN = 2000;
export const SEASON_YEAR_MAX = 2100;
export const RULE_VALUE_MAX = 1_000_000;
export const COUNTRY_TIERS = ["courant", "lointain", "rare", "extreme"] as const;
export const USER_ROLES = ["user", "moderator", "admin"] as const;
export const MODERATION_INTENTS = ["validate", "hide", "unhide", "delete"] as const;

export type CountryTier = (typeof COUNTRY_TIERS)[number];
export type UserRole = (typeof USER_ROLES)[number];
export type ModerationIntent = (typeof MODERATION_INTENTS)[number];

/** Identifiant (toute version) : les comptes de test n'ont pas forcément un UUID v4. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const uuidSchema = z.string().trim().regex(new RegExp(`^${UUID.source}$`, "i")).transform((v) => v.toLowerCase());

/** « 5db043 », « #5DB043 » ou « #5d4 » → « #5DB043 » / « #55DD44 » ; sinon null. */
export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#?/, "#");
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null;
}

export type YearColorCheck =
  | { kind: "invalid"; color: null; ratio: null }
  | { kind: "too-dark"; color: string; ratio: number }
  | { kind: "readable"; color: string; ratio: number };

/** Contrôle d'une couleur saisie : format, puis contraste du texte noir #111111. */
export function checkYearColor(input: string): YearColorCheck {
  const color = normalizeHex(input);
  if (!color) return { kind: "invalid", color: null, ratio: null };
  const ratio = contrastRatio(color, BAND_COLOR);
  return { kind: ratio >= MIN_CONTRAST ? "readable" : "too-dark", color, ratio };
}

/** Message d'erreur d'une couleur, ou null si elle est utilisable. */
export function yearColorError(check: YearColorCheck): string | null {
  if (check.kind === "invalid") return ta.season.invalidHex;
  if (check.kind === "too-dark") return ta.season.tooDark(check.ratio);
  return null;
}

/** Case à cocher d'un formulaire : présente (« on », « true ») ou absente. */
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

const seasonSchema = z.object({
  year: z.coerce.number().int().min(SEASON_YEAR_MIN).max(SEASON_YEAR_MAX),
  colorHex: z.string(),
  makeCurrent: checkbox,
});

export type SeasonInput = { year: number; colorHex: string; makeCurrent: boolean };

export function parseSeasonForm(form: FormData): Parsed<SeasonInput> {
  const parsed = seasonSchema.safeParse({
    year: form.get("year"),
    colorHex: form.get("colorHex") ?? "",
    makeCurrent: form.get("makeCurrent"),
  });
  if (!parsed.success) return { ok: false, error: ta.errors.invalid };
  const check = checkYearColor(parsed.data.colorHex);
  const error = yearColorError(check);
  if (error || !check.color) return { ok: false, error: error ?? ta.season.invalidHex };
  return { ok: true, data: { year: parsed.data.year, colorHex: check.color, makeCurrent: parsed.data.makeCurrent } };
}

/** « 12,5 » ou « 12.5 » ; jamais de valeur vide, négative, infinie ou démesurée. */
export function parseRuleValue(key: string, raw: string): Parsed<number> {
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  const value = text === "" ? Number.NaN : Number(text);
  if (!Number.isFinite(value) || value < 0 || value > RULE_VALUE_MAX) {
    return { ok: false, error: ta.scoring.ruleInvalid };
  }
  if (key === "neighbor_divisor" && value < 1) return { ok: false, error: ta.scoring.divisorInvalid };
  return { ok: true, data: value };
}

const ruleKeySchema = z.string().regex(/^[a-z0-9_]{1,64}$/);

export function parseRuleForm(form: FormData): Parsed<{ key: string; value: number }> {
  const key = ruleKeySchema.safeParse(form.get("key"));
  if (!key.success) return { ok: false, error: ta.errors.invalid };
  const value = parseRuleValue(key.data, String(form.get("value") ?? ""));
  return value.ok ? { ok: true, data: { key: key.data, value: value.data } } : value;
}

const countryTierSchema = z.object({
  iso2: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()),
  tier: z.enum(COUNTRY_TIERS),
});

export function parseCountryTierForm(form: FormData): Parsed<{ iso2: string; tier: CountryTier }> {
  const parsed = countryTierSchema.safeParse({ iso2: form.get("iso2"), tier: form.get("tier") });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: ta.errors.invalid };
}

/** Lien d'un sticker (…/spots/<id>) ou identifiant seul → identifiant en minuscules. */
export function parseSpotReference(input: string): string | null {
  const match = UUID.exec(input.trim());
  return match ? match[0].toLowerCase() : null;
}

export function parseSpotIdForm(form: FormData): Parsed<string> {
  const id = parseSpotReference(String(form.get("spotId") ?? ""));
  return id ? { ok: true, data: id } : { ok: false, error: ta.scoring.recomputeInvalid };
}

const moderationSchema = z.object({ spotId: uuidSchema, intent: z.enum(MODERATION_INTENTS) });

export function parseModerationForm(form: FormData): Parsed<{ spotId: string; intent: ModerationIntent }> {
  const parsed = moderationSchema.safeParse({ spotId: form.get("spotId"), intent: form.get("intent") });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: ta.errors.invalid };
}

const exceptionalSchema = z.object({ spotId: uuidSchema, exceptional: checkbox });

export function parseExceptionalForm(form: FormData): Parsed<{ spotId: string; exceptional: boolean }> {
  const parsed = exceptionalSchema.safeParse({
    spotId: form.get("spotId"),
    exceptional: form.get("exceptional"),
  });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: ta.errors.invalid };
}

const roleSchema = z.object({ userId: uuidSchema, role: z.enum(USER_ROLES) });

export function parseRoleForm(form: FormData): Parsed<{ userId: string; role: UserRole }> {
  const parsed = roleSchema.safeParse({ userId: form.get("userId"), role: form.get("role") });
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: ta.errors.invalid };
}

const suspendSchema = z.object({ userId: uuidSchema, suspended: z.enum(["true", "false"]) });

export function parseSuspendForm(form: FormData): Parsed<{ userId: string; suspended: boolean }> {
  const parsed = suspendSchema.safeParse({ userId: form.get("userId"), suspended: form.get("suspended") });
  return parsed.success
    ? { ok: true, data: { userId: parsed.data.userId, suspended: parsed.data.suspended === "true" } }
    : { ok: false, error: ta.errors.invalid };
}
