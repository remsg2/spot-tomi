/**
 * Filtres de la carte (cahier des charges 5 : année/édition, pays, utilisateur, période)
 * et leur traduction pour spots_in_bbox.
 */
export type MapFilters = {
  /** Éditions (années) sélectionnées ; vide = toutes. */
  years: number[];
  /** Personne choisie (via la recherche ou le panneau de filtres). */
  person: { id: string; username: string } | null;
  /** « Rares » : premier du pays, site remarquable, lieu isolé ou très rare. */
  rare: boolean;
  /** « Mes stickers » (connecté seulement). */
  mine: boolean;
  /** Pays sélectionnés ; vide = tous. */
  countries: Array<{ iso2: string; name: string }>;
  /** Période du collage (jours « AAAA-MM-JJ », bornes incluses). */
  from: string | null;
  to: string | null;
};

export const DEFAULT_FILTERS: MapFilters = {
  years: [],
  person: null,
  rare: false,
  mine: false,
  countries: [],
  from: null,
  to: null,
};

/** Paramètre `filters` de la RPC (contrats §5) : seulement les filtres actifs. */
export type RpcFilters = {
  years?: number[];
  authorId?: string;
  rare?: true;
  mine?: true;
  countries?: string[];
  from?: string;
  to?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function filtersToRpc(filters: MapFilters): RpcFilters {
  const out: RpcFilters = {};
  if (filters.years.length > 0) out.years = [...new Set(filters.years)].sort((a, b) => b - a);
  if (filters.person) out.authorId = filters.person.id;
  if (filters.rare) out.rare = true;
  if (filters.mine) out.mine = true;
  if (filters.countries.length > 0) out.countries = [...new Set(filters.countries.map((c) => c.iso2))].sort();
  if (filters.from && DAY.test(filters.from)) out.from = filters.from;
  if (filters.to && DAY.test(filters.to)) out.to = filters.to;
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
    (filters.mine ? 1 : 0) +
    (filters.countries.length > 0 ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0)
  );
}

export function toggleCountry(filters: MapFilters, country: { iso2: string; name: string }): MapFilters {
  const iso2 = country.iso2.toUpperCase();
  const countries = filters.countries.some((c) => c.iso2 === iso2)
    ? filters.countries.filter((c) => c.iso2 !== iso2)
    : [...filters.countries, { iso2, name: country.name }];
  return { ...filters, countries };
}

/** Période du collage ; une borne vide l'ouvre. Bornes inversées : remises dans l'ordre. */
export function setPeriod(filters: MapFilters, from: string | null, to: string | null): MapFilters {
  const clean = (value: string | null) => (value && DAY.test(value) ? value : null);
  let start = clean(from);
  let end = clean(to);
  if (start && end && start > end) [start, end] = [end, start];
  return { ...filters, from: start, to: end };
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
