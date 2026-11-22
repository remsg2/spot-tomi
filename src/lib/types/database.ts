/**
 * Lignes lues depuis Supabase, partagées par les étapes 5 à 8 (docs/contrats.md, §3).
 * Source : supabase/migrations/20261122000000_modele.sql, à garder synchronisé.
 *
 * Via PostgREST, les `numeric` (altitude_m, value) et les `int` arrivent en nombres
 * JSON, les `timestamptz` en chaînes ISO 8601, les `char(2)` en chaînes.
 */

export const COUNTRY_TIERS = ["courant", "lointain", "rare", "extreme"] as const;
/** Niveau de rareté d'un pays (`public.country_tier`). */
export type CountryTier = (typeof COUNTRY_TIERS)[number];

export const SPOT_STATUSES = ["published", "pending_review", "hidden"] as const;
/** Statut d'un sticker (`public.spot_status`). */
export type SpotStatus = (typeof SPOT_STATUSES)[number];

/**
 * Critères du détail des points (`spot_point_lines.rule_key`), dans l'ordre où
 * `compute_spot_points` les écrit (cahier des charges V1.1) : la base (toujours), le
 * bonus de rareté (toujours, éventuellement nul) et, pour un doublon, la ligne négative
 * qui annule le bonus. Les anciennes clés restent lisibles pour un détail figé avant.
 */
export const POINT_RULE_KEYS = ["base", "rarity", "duplicate"] as const;
export type PointRuleKey = (typeof POINT_RULE_KEYS)[number] | (string & {});

/** Catégorie de rareté d'un lieu (`public.rarity_category`), de la plus commune à la plus rare. */
export const RARITY_CATEGORIES = ["courant", "touristique", "remarquable", "isole", "tres_rare"] as const;
export type RarityCategory = (typeof RARITY_CATEGORIES)[number];

/** Clés de `scoring_rules` (valeurs par défaut dans les migrations). */
export const SCORING_RULE_KEYS = [
  "base_points",
  "bonus_touristique",
  "bonus_remarquable",
  "bonus_isole",
  "bonus_tres_rare",
  "isole_city_km",
  "tres_rare_city_km",
  "isole_altitude_m",
  "tres_rare_altitude_m",
  "neighbor_radius_m",
  "daily_publish_limit",
  "daily_report_limit",
  "reports_before_review",
  "edit_radius_m",
  "edit_window_days",
  "comment_max_length",
] as const;
export type ScoringRuleKey = (typeof SCORING_RULE_KEYS)[number];

/** Une ligne de la vue `public.public_spots` : stickers publiés, position publique. */
export type PublicSpotRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_avatar_path: string | null;
  name: string;
  /** Position publique (la position exacte : plus de floutage depuis le retrait du domicile). */
  lat: number;
  lng: number;
  altitude_m: number | null;
  taken_at: string;
  year: number;
  /** Couleur de l'année (`year_color`), `#9A9A94` pour une année sans saison. */
  color_hex: string;
  country_iso2: string | null;
  country_name_fr: string | null;
  country_tier: CountryTier | null;
  city: string | null;
  /** Chemin dans le bucket `spot-photos` : `{author_id}/{uuid}.webp`. */
  photo_path: string;
  is_exceptional: boolean;
  is_first_in_country: boolean;
  points_total: number;
  created_at: string;
  comment: string | null;
  base_points: number;
  rarity_bonus: number;
  rarity_category: RarityCategory;
  rarity_reason: string | null;
  edition_name: string;
  /** Miniature (480 px) dans `spot-photos`, si elle existe. */
  thumb_path: string | null;
  /** Point du sticker sur la photo (0 à 1), null : centre. */
  focus_x: number | null;
  focus_y: number | null;
};

/** Une ligne de `public.spot_point_lines`, figée au calcul des points. */
export type SpotPointLineRow = {
  spot_id: string;
  rule_key: PointRuleKey;
  /** Ordre d'affichage, à partir de 1. */
  position: number;
  /** Ex. « Premier sticker du pays ». */
  label: string;
  /** Ex. « 1 240 km du sticker le plus proche, plafond ». */
  detail: string | null;
  points: number;
};

/** Une ligne de `public.seasons` (édition annuelle). */
export type SeasonRow = {
  year: number;
  name: string;
  color_hex: string;
  is_current: boolean;
  visual_path: string | null;
  status: "active" | "archived";
};

/** Une ligne de `rpc("list_editions")`. */
export type EditionRow = {
  year: number;
  name: string;
  color_hex: string;
  visual_path: string | null;
  status: "active" | "archived";
  is_current: boolean;
  /** Choisissable à la publication (active, jusqu'à l'édition en cours). */
  selectable: boolean;
  /** Couleur figée : édition passée qui a des stickers. */
  color_locked: boolean;
  spot_count: number;
};

/** Résultat de `rpc("current_season")` (une seule ligne). */
export type CurrentSeason = Pick<SeasonRow, "year" | "color_hex">;

/**
 * Une ligne de `public.countries`, sans la frontière : `geom` (MultiPolygon de
 * plusieurs centaines de Ko pour certains pays) n'est à sélectionner que sciemment.
 */
export type CountryRow = {
  iso2: string;
  iso3: string;
  name_fr: string;
  tier: CountryTier;
};

/** Une ligne de `public.scoring_rules`. */
export type ScoringRuleRow = {
  key: ScoringRuleKey;
  value: number;
  updated_at: string;
  updated_by: string | null;
};
