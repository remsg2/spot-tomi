import { describe, expect, it, vi } from "vitest";
import {
  cityFromReverseGeocode,
  GEOCODER_USER_AGENT,
  memoryCityCache,
  providerFor,
  reverseGeocodeCity,
  reverseGeocodeUrl,
  type CityCache,
} from "./geocode.ts";

const photon = (properties: Record<string, unknown>) => ({
  type: "FeatureCollection",
  features: [{ type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties }],
});

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("cityFromReverseGeocode", () => {
  it("lit la ville d'une réponse Photon", () => {
    expect(cityFromReverseGeocode(photon({ type: "city", name: "Ushuaïa", city: "Ushuaia" }))).toBe("Ushuaïa");
    expect(cityFromReverseGeocode(photon({ type: "street", name: "Rue Oberkampf", city: "Paris" }))).toBe("Paris");
    expect(cityFromReverseGeocode(photon({ osm_key: "place", osm_value: "village", name: "Chamonix" }))).toBe("Chamonix");
  });

  it("lit la ville d'une réponse Nominatim", () => {
    expect(cityFromReverseGeocode({ address: { town: "Dubrovnik", country: "Croatie" } })).toBe("Dubrovnik");
    expect(cityFromReverseGeocode({ address: { city: "Lyon", town: "Autre" } })).toBe("Lyon");
  });

  it("ne renvoie rien sans ville (sommet, océan, réponse inattendue)", () => {
    expect(cityFromReverseGeocode(photon({ type: "other", name: "Mont Blanc", state: "Auvergne-Rhône-Alpes" }))).toBeNull();
    expect(cityFromReverseGeocode({ features: [] })).toBeNull();
    expect(cityFromReverseGeocode("<html>")).toBeNull();
    expect(cityFromReverseGeocode(null)).toBeNull();
  });

  it("nettoie le nom (espaces, caractères de contrôle, longueur)", () => {
    expect(cityFromReverseGeocode(photon({ type: "city", name: "  Saint-\u0007Malo \n " }))).toBe("Saint-Malo");
    expect(cityFromReverseGeocode(photon({ type: "city", name: "x".repeat(300) }))?.length).toBe(120);
  });
});

describe("reverseGeocodeUrl", () => {
  it("interroge Photon en français par défaut, Nominatim si l'URL le désigne", () => {
    const url = new URL(reverseGeocodeUrl("https://photon.komoot.io/reverse", -54.8, -68.3));
    expect(url.searchParams.get("lat")).toBe("-54.8");
    expect(url.searchParams.get("lon")).toBe("-68.3");
    expect(url.searchParams.get("lang")).toBe("fr");
    expect(providerFor("https://nominatim.openstreetmap.org/reverse")).toBe("nominatim");
    const nominatim = new URL(reverseGeocodeUrl("https://nominatim.openstreetmap.org/reverse", 1, 2));
    expect(nominatim.searchParams.get("format")).toBe("jsonv2");
    expect(nominatim.searchParams.get("accept-language")).toBe("fr");
  });
});

describe("reverseGeocodeCity", () => {
  it("envoie un User-Agent générique et un délai court", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response(photon({ type: "city", name: "Ushuaïa" })));
    const result = await reverseGeocodeCity(-54.8, -68.3, { fetch: fetcher });
    expect(result).toEqual({ city: "Ushuaïa", source: "provider" });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/photon\.komoot\.io\/reverse\?/);
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe(GEOCODER_USER_AGENT);
    expect(GEOCODER_USER_AGENT).toBe("SpotTomi/1.0");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("n'échoue jamais : erreur réseau, délai dépassé ou réponse 5xx donnent une ville vide", async () => {
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await reverseGeocodeCity(1, 2, { fetch: offline })).toEqual({ city: null, source: "error" });
    const down = vi.fn<typeof fetch>(async () => response({}, 503));
    expect(await reverseGeocodeCity(1, 2, { fetch: down })).toEqual({ city: null, source: "error" });

    const slow = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("délai", "TimeoutError")));
        }),
    );
    expect(await reverseGeocodeCity(1, 2, { fetch: slow, timeoutMs: 20 })).toEqual({ city: null, source: "error" });
  });

  it("utilise le cache, puis y range la réponse du fournisseur", async () => {
    const cache = memoryCityCache();
    const fetcher = vi.fn<typeof fetch>(async () => response(photon({ type: "city", name: "Paris" })));
    expect(await reverseGeocodeCity(48.8566, 2.3522, { fetch: fetcher, cache })).toEqual({ city: "Paris", source: "provider" });
    // Même case de ~110 m : pas de deuxième appel.
    expect(await reverseGeocodeCity(48.8569, 2.3518, { fetch: fetcher, cache })).toEqual({ city: "Paris", source: "cache" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("ignore un cache en panne", async () => {
    const broken: CityCache = {
      get: async () => {
        throw new Error("base indisponible");
      },
      put: async () => {
        throw new Error("base indisponible");
      },
    };
    const fetcher = vi.fn<typeof fetch>(async () => response(photon({ type: "city", name: "Lyon" })));
    expect(await reverseGeocodeCity(45.76, 4.83, { fetch: fetcher, cache: broken })).toEqual({ city: "Lyon", source: "provider" });
  });

  it("le cache en mémoire garde une taille bornée", async () => {
    const cache = memoryCityCache(2);
    await cache.put(1, 1, "A", "photon");
    await cache.put(2, 2, "B", "photon");
    await cache.put(3, 3, "C", "photon");
    expect(cache.size()).toBe(2);
    expect((await cache.get(1, 1)).hit).toBe(false);
    expect(await cache.get(3, 3)).toEqual({ hit: true, city: "C" });
  });
});
