import { describe, expect, it, vi } from "vitest";
import { elevationFromResponse, elevationUrl, fetchElevation, OPEN_METEO_ELEVATION_URL } from "./elevation.ts";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("elevationFromResponse", () => {
  it("lit l'altitude d'Open-Meteo, arrondie au décimètre", () => {
    expect(elevationFromResponse({ elevation: [4807.04] })).toBe(4807);
    expect(elevationFromResponse({ elevation: [-12.34] })).toBe(-12.3);
  });

  it("refuse une réponse inattendue ou une altitude impossible", () => {
    expect(elevationFromResponse({ elevation: [] })).toBeNull();
    expect(elevationFromResponse({ elevation: ["haut"] })).toBeNull();
    expect(elevationFromResponse({ elevation: [12000] })).toBeNull();
    expect(elevationFromResponse(null)).toBeNull();
  });
});

describe("fetchElevation", () => {
  it("interroge Open-Meteo par défaut, avec un délai court", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => response({ elevation: [3842] }));
    expect(await fetchElevation(45.8326, 6.8652, { fetch: fetcher })).toBe(3842);
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe(elevationUrl(OPEN_METEO_ELEVATION_URL, 45.8326, 6.8652));
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("ne lève jamais : service en panne, réseau coupé ou désactivé donnent null", async () => {
    expect(await fetchElevation(1, 2, { fetch: vi.fn<typeof fetch>(async () => response({}, 503)) })).toBeNull();
    const offline = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchElevation(1, 2, { fetch: offline })).toBeNull();
    const unused = vi.fn<typeof fetch>();
    expect(await fetchElevation(1, 2, { baseUrl: "none", fetch: unused })).toBeNull();
    expect(unused).not.toHaveBeenCalled();
  });
});
