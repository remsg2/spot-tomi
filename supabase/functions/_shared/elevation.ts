/**
 * Altitude d'un point par un service d'élévation (modèle numérique de terrain), quand
 * la photo n'en donne pas : record « Tomi le plus haut », badge des sommets, indice de
 * rareté. Open-Meteo par défaut (Copernicus DEM, 90 m), sans clé ; secret facultatif
 * ELEVATION_URL pour un autre service compatible, ou « none » pour le désactiver.
 *
 * Délai court et échec non bloquant : sans réponse, l'altitude reste inconnue (jamais
 * inventée). Sans dépendance, pour être testé sous Vitest.
 */

export const OPEN_METEO_ELEVATION_URL = "https://api.open-meteo.com/v1/elevation";
export const ELEVATION_TIMEOUT_MS = 2500;

export type ElevationOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export function elevationUrl(baseUrl: string, lat: number, lng: number): string {
  const url = new URL(baseUrl);
  url.searchParams.set("latitude", lat.toFixed(5));
  url.searchParams.set("longitude", lng.toFixed(5));
  return url.toString();
}

/** Lit `{ elevation: [123.4] }` ; altitude plausible (-500 à 9 000 m) ou null. */
export function elevationFromResponse(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const values = (body as { elevation?: unknown }).elevation;
  const value = Array.isArray(values) ? values[0] : values;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < -500 || value > 9000) return null;
  return Math.round(value * 10) / 10;
}

/** Altitude du point, ou null (service désactivé, indisponible ou réponse inattendue). Ne lève jamais. */
export async function fetchElevation(lat: number, lng: number, options: ElevationOptions = {}): Promise<number | null> {
  const baseUrl = options.baseUrl || OPEN_METEO_ELEVATION_URL;
  if (baseUrl === "none") return null;
  const doFetch = options.fetch ?? fetch;
  try {
    const response = await doFetch(elevationUrl(baseUrl, lat, lng), {
      headers: { "User-Agent": "SpotTomi/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? ELEVATION_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return elevationFromResponse(await response.json());
  } catch {
    return null;
  }
}
