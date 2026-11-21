/**
 * Conversion des lignes SQL (snake_case) en objets de l'application : pur, testé.
 */
import type { AlbumRow, CountryTier } from "./album";
import type { ProfileSpot, SpotStatus } from "./spots";

/** « tomi_fan » → motif ILIKE exact (le _ n'est pas un joker). */
export function exactIlikePattern(username: string): string {
  return username.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function sinceYear(createdAt: string): number {
  return new Date(createdAt).getUTCFullYear();
}

export type AlbumSqlRow = {
  iso2: string;
  iso3: string;
  name_fr: string;
  tier: CountryTier;
  conquered: boolean;
  first_year: number | null;
  color_hex: string | null;
  points: number;
  stickers: number;
  gold: boolean;
  suggestion_rank: number | null;
};

export type SpotSqlRow = {
  id: string;
  name: string;
  city: string | null;
  country_iso2: string | null;
  country_name_fr: string | null;
  year: number;
  color_hex: string;
  status: SpotStatus;
  points_total: number;
  is_first_in_country: boolean;
  is_exceptional: boolean;
  taken_at: string;
};

export function toAlbumRow(row: AlbumSqlRow): AlbumRow {
  return {
    iso2: row.iso2,
    iso3: row.iso3,
    nameFr: row.name_fr,
    tier: row.tier,
    conquered: row.conquered,
    firstYear: row.first_year,
    colorHex: row.color_hex,
    points: row.points,
    stickers: row.stickers,
    gold: row.gold,
    suggestionRank: row.suggestion_rank,
  };
}

export function toProfileSpot(row: SpotSqlRow): ProfileSpot {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    countryIso2: row.country_iso2,
    countryName: row.country_name_fr,
    year: row.year,
    colorHex: row.color_hex,
    status: row.status,
    points: row.points_total,
    isFirstInCountry: row.is_first_in_country,
    isExceptional: row.is_exceptional,
    takenAt: row.taken_at,
  };
}
