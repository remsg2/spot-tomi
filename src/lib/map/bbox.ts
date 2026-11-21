/**
 * Zones visibles de la carte → paramètres de spots_in_bbox.
 *
 * MapLibre renvoie des longitudes « dépliées » quand la vue traverse
 * l'antiméridien (ex. ouest 170°, est 190°). La base attend des longitudes dans
 * [-180, 180] ; une zone qui traverse 180° est envoyée avec min_lng > max_lng.
 */

/** Rectangle en degrés, longitudes éventuellement hors de [-180, 180]. */
export type Bounds = { west: number; south: number; east: number; north: number };

/** Arguments nommés de la RPC spots_in_bbox. */
export type BboxArgs = { min_lng: number; min_lat: number; max_lng: number; max_lat: number };

/** Latitude maximale de la projection Mercator. */
export const MAX_LAT = 85.0511;

const round = (value: number) => Math.round(value * 1e5) / 1e5;

/** Ramène une longitude dans [-180, 180[ (180 reste 180). */
export function wrapLng(lng: number): number {
  if (lng >= -180 && lng <= 180) return lng;
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && lng > 0 ? 180 : wrapped;
}

function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/** Agrandit une zone de `ratio` de chaque côté (préchargement autour de la vue). */
export function padBounds(bounds: Bounds, ratio: number): Bounds {
  const dx = (bounds.east - bounds.west) * ratio;
  const dy = (bounds.north - bounds.south) * ratio;
  return {
    west: bounds.west - dx,
    east: bounds.east + dx,
    south: Math.max(-MAX_LAT, bounds.south - dy),
    north: Math.min(MAX_LAT, bounds.north + dy),
  };
}

/** Zone → arguments de spots_in_bbox, antiméridien compris. */
export function toBboxArgs(bounds: Bounds): BboxArgs {
  const min_lat = round(clampLat(Math.min(bounds.south, bounds.north)));
  const max_lat = round(clampLat(Math.max(bounds.south, bounds.north)));
  if (bounds.east - bounds.west >= 360) {
    return { min_lng: -180, min_lat, max_lng: 180, max_lat };
  }
  return {
    min_lng: round(wrapLng(bounds.west)),
    min_lat,
    max_lng: round(wrapLng(bounds.east)),
    max_lat,
  };
}

/** La zone traverse-t-elle l'antiméridien ? */
export function crossesAntimeridian(args: BboxArgs): boolean {
  return args.min_lng > args.max_lng;
}

/** Découpe une zone en rectangles qui ne traversent pas l'antiméridien. */
export function splitArgs(args: BboxArgs): BboxArgs[] {
  if (!crossesAntimeridian(args)) return [args];
  return [
    { ...args, max_lng: 180 },
    { ...args, min_lng: -180 },
  ];
}

/** Le point est-il dans la zone (longitude dans [-180, 180]) ? */
export function containsPoint(args: BboxArgs, lng: number, lat: number): boolean {
  if (lat < args.min_lat || lat > args.max_lat) return false;
  return splitArgs(args).some((box) => lng >= box.min_lng && lng <= box.max_lng);
}

/**
 * La zone `inner` est-elle entièrement couverte par `outer` ? Sert à éviter un
 * nouvel appel quand on déplace un peu la carte à l'intérieur de la zone déjà chargée.
 */
export function containsArgs(outer: BboxArgs, inner: BboxArgs): boolean {
  if (inner.min_lat < outer.min_lat || inner.max_lat > outer.max_lat) return false;
  const outerBoxes = splitArgs(outer);
  return splitArgs(inner).every((box) =>
    outerBoxes.some((o) => box.min_lng >= o.min_lng && box.max_lng <= o.max_lng),
  );
}
