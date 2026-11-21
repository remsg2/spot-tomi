import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({
  result: {
    ok: true,
    env: { appEnv: "production", supabaseUrl: "https://projet.example.test", supabaseKey: "cle-publique" },
  } as unknown,
}));
const cache = vi.hoisted(() => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

vi.mock("next/cache", () => cache);
vi.mock("@/lib/env/server", () => ({ getPublicEnvResult: vi.fn(async () => env.result) }));

const { getCurrentYearColor, SEASON_CACHE_TAG } = await import("./season");

describe("getCurrentYearColor", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    env.result = {
      ok: true,
      env: { appEnv: "production", supabaseUrl: "https://projet.example.test", supabaseKey: "cle-publique" },
    };
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    cache.cacheTag.mockClear();
  });

  it("lit current_season() de Supabase et étiquette le cache « season »", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ year: 2027, color_hex: "#5db043" }])));
    await expect(getCurrentYearColor()).resolves.toBe("#5DB043");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://projet.example.test/rest/v1/rpc/current_season",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ apikey: "cle-publique" }) }),
    );
    expect(cache.cacheTag).toHaveBeenCalledWith(SEASON_CACHE_TAG);
  });

  it("revient au gris sans configuration Supabase, sans appeler le réseau", async () => {
    env.result = { ok: false, appEnv: "local", missing: ["SUPABASE_URL"] };
    await expect(getCurrentYearColor()).resolves.toBe("#9A9A94");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("revient au gris si Supabase répond mal ou pas du tout", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await expect(getCurrentYearColor()).resolves.toBe("#9A9A94");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ color_hex: "javascript:1" }])));
    await expect(getCurrentYearColor()).resolves.toBe("#9A9A94");
    fetchMock.mockRejectedValueOnce(new Error("réseau"));
    await expect(getCurrentYearColor()).resolves.toBe("#9A9A94");
  });
});
