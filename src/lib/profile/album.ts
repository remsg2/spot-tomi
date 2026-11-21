/**
 * Album du profil : logique pure, testée par Vitest.
 * La base renvoie les pays conquis et, pour chaque niveau de rareté, jusqu'à
 * trois suggestions classées ; ce module choisit lesquelles montrer.
 */

export type CountryTier = "courant" | "lointain" | "rare" | "extreme";

/** Ligne renvoyée par public.album(p_user), en camelCase. */
export type AlbumRow = {
  iso2: string;
  iso3: string;
  nameFr: string;
  tier: CountryTier;
  conquered: boolean;
  firstYear: number | null;
  colorHex: string | null;
  /** Pays conquis : points cumulés. Pays à conquérir : points de base. */
  points: number;
  stickers: number;
  gold: boolean;
  suggestionRank: number | null;
};

export type ConqueredTile = {
  iso2: string;
  iso3: string;
  nameFr: string;
  year: number;
  color: string;
  points: number;
  gold: boolean;
  tilt: number;
};

export type LockedTile = {
  iso2: string;
  iso3: string;
  nameFr: string;
  tier: CountryTier;
  points: number;
};

export type LegendItem = { year: number; color: string; short: string };

export type AlbumView = {
  conquered: ConqueredTile[];
  toConquer: LockedTile[];
  legend: LegendItem[];
};

export const ALBUM_COLUMNS = 4;
const FALLBACK = "#9A9A94";
const TIER_ORDER: CountryTier[] = ["courant", "lointain", "rare", "extreme"];
const TILTS = [-3, 2, -2, 3, -1, 1] as const;

/** Légère rotation stable par pays (−3° à +3°), comme sur les maquettes. */
export function tileTilt(code: string): number {
  let hash = 0;
  for (const char of code) hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  return TILTS[hash % TILTS.length];
}

/**
 * Pays à conquérir montrés : un par niveau de rareté encore ouvert (du moins
 * cher au plus cher), puis d'autres suggestions pour finir la dernière rangée
 * de la grille. Rien d'autre que des pays non conquis.
 */
export function chooseCountriesToConquer(
  candidates: readonly AlbumRow[],
  conqueredCount: number,
  columns = ALBUM_COLUMNS,
): LockedTile[] {
  const open = candidates
    .filter((row) => !row.conquered)
    .sort(
      (a, b) =>
        (a.suggestionRank ?? Infinity) - (b.suggestionRank ?? Infinity) ||
        TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
        a.points - b.points ||
        a.iso3.localeCompare(b.iso3),
    );

  const chosen: AlbumRow[] = [];
  const seenTiers = new Set<CountryTier>();
  for (const row of open) {
    if (!seenTiers.has(row.tier)) {
      seenTiers.add(row.tier);
      chosen.push(row);
    }
  }
  for (const row of open) {
    if ((conqueredCount + chosen.length) % columns === 0) break;
    if (!chosen.includes(row)) chosen.push(row);
  }

  return chosen
    .sort(
      (a, b) =>
        a.points - b.points ||
        TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) ||
        (a.suggestionRank ?? 0) - (b.suggestionRank ?? 0),
    )
    .map(({ iso2, iso3, nameFr, tier, points }) => ({ iso2, iso3, nameFr, tier, points }));
}

/** Années présentes dans l'album, dans l'ordre, avec leur couleur. */
export function albumLegend(tiles: readonly Pick<ConqueredTile, "year" | "color">[]): LegendItem[] {
  const byYear = new Map<number, string>();
  for (const tile of tiles) if (!byYear.has(tile.year)) byYear.set(tile.year, tile.color);
  return [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, color]) => ({ year, color, short: String(year).slice(-2) }));
}

/** Tuiles conquises dans l'ordre de conquête, puis légende et pays à conquérir. */
export function buildAlbumView(rows: readonly AlbumRow[], columns = ALBUM_COLUMNS): AlbumView {
  const conquered = rows
    .filter((row) => row.conquered && row.firstYear !== null)
    .sort((a, b) => (a.firstYear ?? 0) - (b.firstYear ?? 0) || a.nameFr.localeCompare(b.nameFr, "fr"))
    .map((row) => ({
      iso2: row.iso2,
      iso3: row.iso3,
      nameFr: row.nameFr,
      year: row.firstYear as number,
      color: row.colorHex ?? FALLBACK,
      points: row.points,
      gold: row.gold,
      tilt: tileTilt(row.iso3),
    }));
  return {
    conquered,
    toConquer: chooseCountriesToConquer(rows, conquered.length, columns),
    legend: albumLegend(conquered),
  };
}
