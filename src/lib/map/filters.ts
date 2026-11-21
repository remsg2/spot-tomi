/** Filtres de la carte (spécifications 2.3) et leur traduction pour spots_in_bbox. */
export type MapFilters = {
  /** Années sélectionnées ; vide = toutes. */
  years: number[];
  /** Personne choisie (via la recherche ou le panneau de filtres). */
  person: { id: string; username: string } | null;
  /** « Rares » : anneau doré ou pays à 60 points de base et plus. */
  rare: boolean;
  /** « Mes stickers » (connecté seulement). */
  mine: boolean;
};

export const DEFAULT_FILTERS: MapFilters = { years: [], person: null, rare: false, mine: false };

/** Paramètre `filters` de la RPC (contrats §5) : seulement les filtres actifs. */
export type RpcFilters = { years?: number[]; authorId?: string; rare?: true; mine?: true };

export function filtersToRpc(filters: MapFilters): RpcFilters {
  const out: RpcFilters = {};
  if (filters.years.length > 0) out.years = [...new Set(filters.years)].sort((a, b) => b - a);
  if (filters.person) out.authorId = filters.person.id;
  if (filters.rare) out.rare = true;
  if (filters.mine) out.mine = true;
  return out;
}

/** Clé stable d'un jeu de filtres (cache et comparaison). */
export function filtersKey(filters: MapFilters): string {
  return JSON.stringify(filtersToRpc(filters));
}

export function activeFilterCount(filters: MapFilters): number {
  return (
    (filters.years.length > 0 ? 1 : 0) +
    (filters.person ? 1 : 0) +
    (filters.rare ? 1 : 0) +
    (filters.mine ? 1 : 0)
  );
}

export function toggleYear(filters: MapFilters, year: number): MapFilters {
  const years = filters.years.includes(year)
    ? filters.years.filter((y) => y !== year)
    : [...filters.years, year];
  return { ...filters, years };
}

/**
 * « Mes stickers » et « une personne » s'excluent : choisir l'un retire l'autre
 * (sinon le résultat serait vide dès que la personne n'est pas soi).
 */
export function setMine(filters: MapFilters, mine: boolean): MapFilters {
  return { ...filters, mine, person: mine ? null : filters.person };
}

export function setPerson(filters: MapFilters, person: MapFilters["person"]): MapFilters {
  return { ...filters, person, mine: person ? false : filters.mine };
}
