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
 * `compute_spot_points` les écrit. Seuls ceux qui rapportent des points sont présents,
 * plus la base (toujours) et le malus voisin (valeur négative) s'il s'applique.
 */
export const POINT_RULE_KEYS = [
  "base_country",
  "first_country",
  "first_city",
  "isolation",
  "exceptional",
  "altitude",
  "home_distance",
  "neighbor_malus",
] as const;
export type PointRuleKey = (typeof POINT_RULE_KEYS)[number];

/** Clés de `scoring_rules` (valeurs par défaut dans la migration). */
export const SCORING_RULE_KEYS = [
  "tier_courant",
  "tier_lointain",
  "tier_rare",
  "tier_extreme",
  "bonus_first_country",
  "bonus_first_city",
  "isolation_points_per_10km",
  "isolation_cap",
  "bonus_exceptional",
  "altitude_threshold_m",
  "bonus_altitude",
  "home_points_per_1000km",
  "neighbor_radius_m",
  "neighbor_divisor",
  "home_blur_radius_m",
  "daily_publish_limit",
  "daily_report_limit",
  "reports_before_review",
  "edit_radius_m",
] as const;
export type ScoringRuleKey = (typeof SCORING_RULE_KEYS)[number];

/** Une ligne de la vue `public.public_spots` : stickers publiés, position publique. */
export type PublicSpotRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_avatar_path: string | null;
  name: string;
  /** Position publique (décalée et arrondie près du domicile de l'auteur). */
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

/** Une ligne de `public.seasons`. */
export type SeasonRow = {
  year: number;
  color_hex: string;
  is_current: boolean;
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
