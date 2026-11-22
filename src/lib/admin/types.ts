import type { CountryTier, UserRole } from "@/lib/validation/admin";

export type SpotStatus = "published" | "pending_review" | "hidden";

export type SpotReport = {
  reason: string | null;
  created_at: string;
  reporter_username: string | null;
  status?: "pending" | "accepted" | "rejected";
};

/** Ligne de admin_moderation_queue() / admin_search_spots() : position exacte comprise. */
export type ModerationItem = {
  id: string;
  name: string;
  status: SpotStatus;
  author_id: string;
  author_username: string;
  city: string | null;
  country_iso2: string | null;
  country_name_fr: string | null;
  year: number;
  color_hex: string;
  taken_at: string;
  created_at: string;
  gps_source: "exif" | "device" | "manual";
  date_source: "exif" | "device" | "manual" | "upload";
  lat: number;
  lng: number;
  public_lat: number;
  public_lng: number;
  altitude_m: number | null;
  photo_path: string;
  points_total: number;
  is_exceptional: boolean;
  is_first_in_country: boolean;
  report_count: number;
  reports: SpotReport[];
  needs_review?: boolean;
  review_reason?: string | null;
  comment?: string | null;
  rarity_category?: string | null;
  rarity_override?: string | null;
  rarity_reason?: string | null;
  thumb_path?: string | null;
  /** Point du sticker sur la photo (0 à 1), null : centre. */
  focus_x?: number | null;
  focus_y?: number | null;
};

/** Élément de la file, avec l'URL publique de sa photo (calculée côté serveur). */
export type ModerationEntry = ModerationItem & { photo_url: string | null };

export type Season = { year: number; color_hex: string; is_current: boolean };

/** Ligne de list_editions() (onglet Éditions). */
export type Edition = {
  year: number;
  name: string;
  color_hex: string;
  visual_path: string | null;
  status: "active" | "archived";
  is_current: boolean;
  selectable: boolean;
  color_locked: boolean;
  spot_count: number;
};

export type AdminBadge = {
  code: string;
  name: string;
  description: string;
  icon: string;
  active: boolean;
  unlocked: number;
};

export type AppError = {
  id: number;
  created_at: string;
  source: string;
  message: string;
  digest: string | null;
  path: string | null;
  user_agent: string | null;
  username: string | null;
};
export type MissingSeasonYear = { year: number; spot_count: number };

export type ScoringRule = { key: string; value: number; updated_at: string };
export type CountryRow = { iso2: string; iso3: string; name_fr: string; tier: CountryTier };

export type AdminUser = {
  id: string;
  username: string;
  avatar_path: string | null;
  role: UserRole;
  suspended_at: string | null;
  created_at: string;
  spot_count: number;
  published_count: number;
};

export type AuditEntry = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_username: string | null;
  action: string;
  target: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

/** Résultat d'une Server Action de l'admin, affiché tel quel (role="status" ou "alert"). */
export type ActionResult = { ok: boolean; message: string };

export type SeasonActionResult = ActionResult & { color?: string; year?: number; makeCurrent?: boolean };
