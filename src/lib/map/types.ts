/** Propriétés d'un marqueur, telles que renvoyées par spots_in_bbox (contrats §5). */
export type SpotProperties = {
  id: string;
  color: string;
  points: number;
  gold: boolean;
  pending: boolean;
};

export type SpotFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: SpotProperties;
};

export type SpotCollection = {
  type: "FeatureCollection";
  features: SpotFeature[];
  /** Plus de stickers dans la zone que le plafond renvoyé. */
  truncated?: boolean;
};

export const EMPTY_COLLECTION: SpotCollection = { type: "FeatureCollection", features: [] };

/** Une ligne de la vue public_spots (colonnes utiles à la carte et à la fiche). */
export type PublicSpot = {
  id: string;
  author_id: string;
  author_username: string;
  author_avatar_path: string | null;
  name: string;
  lat: number;
  lng: number;
  altitude_m: number | null;
  taken_at: string;
  year: number;
  color_hex: string;
  country_iso2: string | null;
  country_name_fr: string | null;
  country_tier: string | null;
  city: string | null;
  photo_path: string;
  is_exceptional: boolean;
  is_first_in_country: boolean;
  points_total: number;
  created_at: string;
};

export type Season = { year: number; color_hex: string; is_current: boolean };

export type CountryRarity = {
  iso2: string;
  tier: "courant" | "lointain" | "rare" | "extreme";
  base_points: number;
  spot_count: number;
};

export type SearchKind = "spot" | "country" | "user";

/** Une ligne renvoyée par search_spots. */
export type SearchResult = {
  kind: SearchKind;
  id: string;
  label: string;
  detail: string | null;
  lng: number | null;
  lat: number | null;
  bbox: [number, number, number, number] | null;
  color: string | null;
  points: number | null;
  spot_count: number | null;
};

export type ThemeName = "light" | "dark";
