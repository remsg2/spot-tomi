/** Résultats de search_spots : regroupement et cadrage de la carte. */
import type { SearchKind, SearchResult } from "./types";

export type GroupedResults = Record<SearchKind, SearchResult[]>;

export function groupResults(rows: SearchResult[]): GroupedResults {
  const groups: GroupedResults = { spot: [], country: [], user: [] };
  for (const row of rows) groups[row.kind]?.push(row);
  return groups;
}

/** Résultats dans l'ordre d'affichage (lieux, pays, personnes) pour la navigation clavier. */
export function flattenResults(groups: GroupedResults): SearchResult[] {
  return [...groups.spot, ...groups.country, ...groups.user];
}

export type CameraTarget =
  | { type: "fit"; bbox: [number, number, number, number] }
  | { type: "fly"; center: [number, number]; zoom: number };

const SPOT_ZOOM = 14;
const COUNTRY_ZOOM = 3.5;
const PERSON_ZOOM = 9;

/**
 * Où emmener la carte pour un résultat. Une emprise plus large qu'un demi-monde
 * (pays à cheval sur l'antiméridien, comme la Russie ou les Fidji) donnerait une
 * vue absurde : on vise alors un point intérieur.
 */
export function targetForResult(result: SearchResult): CameraTarget | null {
  const point: [number, number] | null =
    result.lng !== null && result.lat !== null ? [result.lng, result.lat] : null;

  if (result.kind === "spot") {
    return point ? { type: "fly", center: point, zoom: SPOT_ZOOM } : null;
  }

  const bbox = result.bbox;
  if (bbox && bbox.length === 4 && bbox.every(Number.isFinite)) {
    const [west, south, east, north] = bbox;
    const width = east - west;
    if (width <= 180) {
      // Emprise ponctuelle (une personne avec un seul sticker) : on vole vers le point.
      if (width < 0.01 && north - south < 0.01) {
        return { type: "fly", center: [west, south], zoom: PERSON_ZOOM + 3 };
      }
      return { type: "fit", bbox: [west, south, east, north] };
    }
  }
  if (point) {
    return { type: "fly", center: point, zoom: result.kind === "country" ? COUNTRY_ZOOM : PERSON_ZOOM };
  }
  return null;
}
