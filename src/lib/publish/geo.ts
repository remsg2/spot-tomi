/**
 * Géométrie sur la sphère terrestre, pour le sélecteur de position :
 * distance, cap, point de destination et limite du déplacement (200 m).
 * Sphère de rayon moyen : l'écart avec l'ellipsoïde de PostGIS reste sous
 * 0,5 %, d'où une petite marge sous le rayon autorisé.
 */

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function isValidLatLng(point: LatLng | null | undefined): point is LatLng {
  return (
    !!point &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

/** Longitude ramenée dans [-180, 180]. */
export function normalizeLng(lng: number): number {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 && lng > 0 ? 180 : wrapped;
}

/** Distance du grand cercle, en mètres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap initial de a vers b, en degrés (0 = nord, 90 = est). */
export function bearingDegrees(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point atteint depuis `origin` en suivant `bearing` sur `distance` mètres. */
export function destination(origin: LatLng, bearing: number, distance: number): LatLng {
  const δ = distance / EARTH_RADIUS_M;
  const θ = toRad(bearing);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: normalizeLng(toDeg(λ2)) };
}

/** Marge sous le rayon autorisé (arrondis, sphère contre ellipsoïde). */
export const RADIUS_SAFETY_RATIO = 0.99;

/**
 * Limite le déplacement d'une position GPS : un point plus loin que
 * `radius` mètres de `origin` est ramené sur le cercle, dans la même direction.
 */
export function clampToRadius(origin: LatLng, candidate: LatLng, radius: number): LatLng {
  const distance = distanceMeters(origin, candidate);
  if (distance <= radius * RADIUS_SAFETY_RATIO) return candidate;
  return destination(origin, bearingDegrees(origin, candidate), radius * RADIUS_SAFETY_RATIO);
}

/** Cercle (polygone GeoJSON) de `radius` mètres autour de `center`. */
export function circlePolygon(center: LatLng, radius: number, steps = 64): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const point = destination(center, (i * 360) / steps, radius);
    ring.push([point.lng, point.lat]);
  }
  return ring;
}
