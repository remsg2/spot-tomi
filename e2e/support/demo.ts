/** Données de démonstration des tests de la carte (mêmes identifiants que le faux Supabase). */
export const USHUAIA_ID = "00000000-0000-4000-8000-00000000c001";
export const MONT_BLANC_ID = "00000000-0000-4000-8000-00000000c002";

/** Les tests qui lisent ces données ne tournent que contre la build locale (faux Supabase). */
export const usesMockData = !process.env.PLAYWRIGHT_BASE_URL;

type BboxBody = { min_lng: number; min_lat: number; max_lng: number; max_lat: number; filters?: unknown };

/** Générateur pseudo-aléatoire déterministe (mêmes stickers à chaque exécution). */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const COLORS = ["#5B8DEF", "#FF7A59", "#F2C230"];

/**
 * 5 000 stickers de démo : la moitié en Europe (zone dense), le reste partout.
 * Points de 1 à 200, environ 5 % avec anneau doré.
 */
export function demoFeatures(count = 5000) {
  const next = random(42);
  return Array.from({ length: count }, (_, i) => {
    const europe = i % 2 === 0;
    const lng = europe ? -10 + next() * 40 : -179 + next() * 358;
    const lat = europe ? 36 + next() * 22 : -55 + next() * 125;
    const points = 1 + Math.floor(next() * 200);
    return {
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] },
      properties: {
        id: `00000000-0000-4000-9000-${String(i).padStart(12, "0")}`,
        color: COLORS[i % COLORS.length],
        points,
        gold: next() < 0.05,
        pending: false,
      },
    };
  });
}

/** Filtre les stickers comme spots_in_bbox (antiméridien compris), au plus 5 000. */
export function inBbox(features: ReturnType<typeof demoFeatures>, body: BboxBody) {
  const inside = features.filter(({ geometry: { coordinates: [lng, lat] } }) => {
    if (lat < body.min_lat || lat > body.max_lat) return false;
    return body.min_lng <= body.max_lng
      ? lng >= body.min_lng && lng <= body.max_lng
      : lng >= body.min_lng || lng <= body.max_lng;
  });
  return { type: "FeatureCollection", features: inside.slice(0, 5000), truncated: inside.length > 5000 };
}
