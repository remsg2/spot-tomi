/** Stickers à l'écran : compteur « N stickers à l'écran · X pts » et liste de la colonne. */
import { containsPoint, type BboxArgs } from "./bbox";
import type { SpotFeature, SpotProperties } from "./types";

export type VisibleSummary = {
  count: number;
  points: number;
  /** Les plus forts en points d'abord, au plus `limit`. */
  top: SpotProperties[];
};

export function summarizeVisible(features: SpotFeature[], view: BboxArgs, limit = 30): VisibleSummary {
  let count = 0;
  let points = 0;
  const inside: SpotProperties[] = [];
  for (const feature of features) {
    const [lng, lat] = feature.geometry.coordinates;
    if (!containsPoint(view, lng, lat)) continue;
    count += 1;
    if (!feature.properties.pending) points += feature.properties.points;
    inside.push(feature.properties);
  }
  inside.sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
  return { count, points, top: inside.slice(0, limit) };
}
