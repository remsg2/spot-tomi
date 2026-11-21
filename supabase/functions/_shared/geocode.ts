/**
 * Géocodage inverse de la ville d'un sticker, côté serveur (Edge Function), et repérage
 * d'un site touristique ou historique OpenStreetMap à proximité (indice de rareté).
 * Photon (komoot) par défaut ; Nominatim si l'URL configurée le désigne (ville seule).
 * Délai court et échec non bloquant : sans réponse, la ville reste vide.
 * Sans dépendance, pour être testé sous Vitest.
 */

export const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";
/** User-Agent générique : aucune donnée sur l'utilisateur ni le projet. */
export const GEOCODER_USER_AGENT = "SpotTomi/1.0";
export const GEOCODER_TIMEOUT_MS = 2500;

export type GeocodeProvider = "photon" | "nominatim";

export type CityCache = {
  get(lat: number, lng: number): Promise<{ hit: boolean; city: string | null; tourist?: boolean | null }>;
  put(lat: number, lng: number, city: string | null, provider: GeocodeProvider, tourist?: boolean | null): Promise<void>;
};

export type GeocodeOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  cache?: CityCache;
};

export type GeocodeResult = {
  city: string | null;
  /** Site touristique ou historique à moins de ~300 m (Photon seulement). */
  tourist: boolean;
  source: "cache" | "provider" | "error";
};

/** Rayon de recherche des sites touristiques (km, paramètre radius de Photon). */
export const TOURIST_RADIUS_KM = 0.3;

export function providerFor(baseUrl: string): GeocodeProvider {
  return /nominatim/i.test(baseUrl) ? "nominatim" : "photon";
}

export function reverseGeocodeUrl(baseUrl: string, lat: number, lng: number): string {
  const url = new URL(baseUrl);
  if (providerFor(baseUrl) === "nominatim") {
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "10");
    url.searchParams.set("accept-language", "fr");
  } else {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("lang", "fr");
    url.searchParams.set("limit", "10");
    url.searchParams.set("radius", String(TOURIST_RADIUS_KM));
  }
  return url.toString();
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Caractères de contrôle retirés, espaces réduits.
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return text === "" ? null : text.slice(0, 120);
}

const PLACE_VALUES = new Set(["city", "town", "village", "municipality"]);

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null;

/** Extrait la ville d'une réponse Photon (GeoJSON) ou Nominatim (jsonv2). */
export function cityFromReverseGeocode(body: unknown): string | null {
  if (!isObject(body)) return null;

  // Nominatim : { address: { city | town | village | municipality } }
  if (isObject(body.address)) {
    const address = body.address;
    return clean(address.city) ?? clean(address.town) ?? clean(address.village) ?? clean(address.municipality);
  }

  // Photon : { features: [{ properties: { type, name, city, osm_key, osm_value } }] }
  if (!Array.isArray(body.features)) return null;
  for (const feature of body.features) {
    if (!isObject(feature) || !isObject(feature.properties)) continue;
    const props = feature.properties;
    if (props.type === "city") return clean(props.name);
    const city = clean(props.city);
    if (city) return city;
    if (props.osm_key === "place" && typeof props.osm_value === "string" && PLACE_VALUES.has(props.osm_value)) {
      return clean(props.name);
    }
  }
  return null;
}

const TOURISM_VALUES = new Set([
  "attraction",
  "viewpoint",
  "museum",
  "artwork",
  "gallery",
  "zoo",
  "theme_park",
  "aquarium",
]);

/**
 * Un site touristique ou historique parmi les objets proches renvoyés par Photon :
 * tourism=attraction|viewpoint|museum…, ou tout objet historic=* (château, monument,
 * ruines…). Nominatim (zoom ville) ne renseigne pas : false.
 */
export function touristFromReverseGeocode(body: unknown): boolean {
  if (!isObject(body) || !Array.isArray(body.features)) return false;
  return body.features.some((feature) => {
    if (!isObject(feature) || !isObject(feature.properties)) return false;
    const { osm_key: key, osm_value: value } = feature.properties;
    if (key === "historic") return true;
    return key === "tourism" && typeof value === "string" && TOURISM_VALUES.has(value);
  });
}

/** Ville du point : cache, sinon fournisseur (puis mise en cache). Ne lève jamais. */
export async function reverseGeocodeCity(
  lat: number,
  lng: number,
  options: GeocodeOptions = {},
): Promise<GeocodeResult> {
  const baseUrl = options.baseUrl || PHOTON_REVERSE_URL;
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? GEOCODER_TIMEOUT_MS;

  if (options.cache) {
    try {
      const cached = await options.cache.get(lat, lng);
      // Case enregistrée avant le repérage des sites touristiques : on la complète.
      if (cached.hit && (cached.tourist !== null && cached.tourist !== undefined || providerFor(baseUrl) === "nominatim")) {
        return { city: cached.city, tourist: cached.tourist === true, source: "cache" };
      }
    } catch {
      // Cache indisponible : on interroge le fournisseur.
    }
  }

  let city: string | null;
  let tourist: boolean;
  try {
    const response = await doFetch(reverseGeocodeUrl(baseUrl, lat, lng), {
      headers: { "User-Agent": GEOCODER_USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { city: null, tourist: false, source: "error" };
    const body = await response.json();
    city = cityFromReverseGeocode(body);
    tourist = touristFromReverseGeocode(body);
  } catch {
    return { city: null, tourist: false, source: "error" };
  }

  if (options.cache) {
    try {
      await options.cache.put(lat, lng, city, providerFor(baseUrl), tourist);
    } catch {
      // Mise en cache facultative.
    }
  }
  return { city, tourist, source: "provider" };
}

/** Petit cache en mémoire (par instance d'Edge Function), en plus du cache en base. */
export function memoryCityCache(maxEntries = 500): CityCache & { size(): number } {
  const entries = new Map<string, { city: string | null; tourist: boolean | null }>();
  const key = (lat: number, lng: number) => `${lat.toFixed(3)},${lng.toFixed(3)}`;
  return {
    async get(lat, lng) {
      const entry = entries.get(key(lat, lng));
      return entry ? { hit: true, city: entry.city, tourist: entry.tourist } : { hit: false, city: null };
    },
    async put(lat, lng, city, _provider, tourist = null) {
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key(lat, lng), { city, tourist });
    },
    size: () => entries.size,
  };
}
