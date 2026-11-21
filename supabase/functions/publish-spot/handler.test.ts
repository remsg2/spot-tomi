import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { photoPathFor, type PublishResult } from "../_shared/publish-contract.ts";
import { handlePublishRequest, type PublishDeps } from "./handler.ts";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../../../e2e/fixtures/${name}`, import.meta.url))));
const CLEAN = fixture("webp-propre.webp");
const DIRTY = fixture("webp-avec-metadonnees.webp");

const USER = "6f1c2c3e-1111-4a2b-9c3d-0123456789ab";
const SPOT = "0b8e9a7c-2222-4d3e-8f00-abcdefabcdef";
const PATH = photoPathFor(USER, "9d9d9d9d-3333-4e4e-8f8f-123412341234");

const body = {
  photoPath: PATH,
  lat: -54.8019,
  lng: -68.303,
  altitude: 25.5,
  takenAt: "2026-03-14T19:42:00.000Z",
  gpsSource: "exif",
  dateSource: "exif",
  name: "Panneau du bout du monde",
};

const loaded: Pick<PublishResult, "spot" | "lines"> = {
  spot: {
    id: SPOT,
    name: body.name,
    city: "Ushuaïa",
    countryNameFr: "Argentine",
    year: 2026,
    colorHex: "#5B8DEF",
    status: "published",
    pointsTotal: 195,
    isFirstInCountry: true,
    isExceptional: false,
  },
  lines: [{ ruleKey: "base", label: "Pays lointain", detail: null, points: 25 }],
};

function deps(overrides: Partial<PublishDeps> = {}): PublishDeps & Record<string, ReturnType<typeof vi.fn>> {
  const ranks = [5, 2];
  return {
    getUserId: vi.fn(async (token: string) => (token === "jeton-valide" ? USER : null)),
    downloadPhoto: vi.fn(async () => CLEAN),
    removePhoto: vi.fn(async () => {}),
    geocodeCity: vi.fn(async () => "Ushuaïa"),
    createSpot: vi.fn(async () => ({ id: SPOT })),
    loadSpot: vi.fn(async () => loaded),
    currentRank: vi.fn(async () => ranks.shift() ?? null),
    refreshLeaderboard: vi.fn(async () => {}),
    ...overrides,
  } as PublishDeps & Record<string, ReturnType<typeof vi.fn>>;
}

function post(payload: unknown, token: string | null = "jeton-valide"): Request {
  return new Request("https://exemple.test/functions/v1/publish-spot", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

describe("publish-spot", () => {
  it("répond aux requêtes CORS préalables sans jeton", async () => {
    const response = await handlePublishRequest(new Request("https://exemple.test", { method: "OPTIONS" }), deps());
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("authorization");
  });

  it("refuse une requête sans jeton valide (401)", async () => {
    const d = deps();
    expect((await handlePublishRequest(post(body, null), d)).status).toBe(401);
    expect((await handlePublishRequest(post(body, "faux"), d)).status).toBe(401);
    expect(d.createSpot).not.toHaveBeenCalled();
  });

  it("publie : ville géocodée, create_spot avec la clé service, rang avant et après", async () => {
    const d = deps();
    const response = await handlePublishRequest(post(body), d);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...loaded, rank: { before: 5, after: 2 } });
    expect(d.createSpot).toHaveBeenCalledWith({
      p_author: USER,
      p_name: body.name,
      p_lat: body.lat,
      p_lng: body.lng,
      p_altitude_m: 25.5,
      p_taken_at: body.takenAt,
      p_gps_source: "exif",
      p_date_source: "exif",
      p_photo_path: PATH,
      p_city: "Ushuaïa",
    });
    expect(d.refreshLeaderboard).toHaveBeenCalledTimes(1);
    expect(d.removePhoto).not.toHaveBeenCalled();
  });

  it("refuse et supprime une photo qui contient encore EXIF, XMP ou ICC", async () => {
    const d = deps({ downloadPhoto: vi.fn(async () => DIRTY) });
    const response = await handlePublishRequest(post(body), d);
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("photo_metadata");
    expect(d.removePhoto).toHaveBeenCalledWith(PATH);
    expect(d.createSpot).not.toHaveBeenCalled();
  });

  it("refuse une photo qui n'est pas un WebP", async () => {
    const d = deps({ downloadPhoto: vi.fn(async () => fixture("sticker-sans-gps.jpg")) });
    const response = await handlePublishRequest(post(body), d);
    expect((await response.json()).error.code).toBe("photo_invalid");
    expect(d.removePhoto).toHaveBeenCalledWith(PATH);
  });

  it("refuse une photo absente ou rangée dans le dossier d'un autre", async () => {
    expect((await handlePublishRequest(post(body), deps({ downloadPhoto: vi.fn(async () => null) }))).status).toBe(400);
    const other = { ...body, photoPath: photoPathFor("aaaaaaaa-1111-4a2b-9c3d-0123456789ab", SPOT) };
    const response = await handlePublishRequest(post(other), deps());
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("invalid_input");
  });

  it("refuse une entrée invalide (JSON, schéma partagé)", async () => {
    expect((await handlePublishRequest(post("{pas du json"), deps())).status).toBe(400);
    const response = await handlePublishRequest(post({ ...body, lat: 120, name: "" }), deps());
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error.code).toBe("invalid_input");
    expect(json.error.message).toContain("lat");
  });

  it("traduit les refus de create_spot (suspension, limites) et supprime la photo", async () => {
    const cases = [
      ["ST002", 403, "suspended"],
      ["ST003", 429, "daily_limit"],
      ["ST004", 409, "nearby_today"],
      ["ST005", 400, "invalid_input"],
    ] as const;
    for (const [sqlCode, status, code] of cases) {
      const d = deps({ createSpot: vi.fn(async () => ({ sqlCode, message: "Message SQL en français." })) });
      const response = await handlePublishRequest(post(body), d);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: { code, message: "Message SQL en français." } });
      expect(d.removePhoto).toHaveBeenCalledWith(PATH);
    }
  });

  it("garde la photo si elle appartient déjà à un autre sticker (ST006)", async () => {
    const d = deps({ createSpot: vi.fn(async () => ({ sqlCode: "ST006", message: "Cette photo a déjà été publiée." })) });
    expect((await handlePublishRequest(post(body), d)).status).toBe(409);
    expect(d.removePhoto).not.toHaveBeenCalled();
  });

  it("géocodage et classement en panne : la publication réussit quand même (rang null)", async () => {
    const d = deps({
      geocodeCity: vi.fn(async () => {
        throw new Error("Photon injoignable");
      }),
      currentRank: vi.fn(async () => {
        throw new Error("relation \"leaderboard\" does not exist");
      }),
    });
    const response = await handlePublishRequest(post(body), d);
    expect(response.status).toBe(200);
    expect((await response.json()).rank).toEqual({ before: null, after: null });
    expect((d.createSpot as ReturnType<typeof vi.fn>).mock.calls[0][0].p_city).toBeNull();
  });

  it("sticker en attente : pas de rafraîchissement du classement, rang inchangé, date d'envoi", async () => {
    const pending = { ...loaded, spot: { ...loaded.spot, status: "pending_review" as const } };
    const d = deps({ loadSpot: vi.fn(async () => pending) });
    const response = await handlePublishRequest(post({ ...body, gpsSource: "manual", dateSource: "upload", takenAt: null }), d);
    expect(response.status).toBe(200);
    expect((await response.json()).rank).toEqual({ before: 5, after: 5 });
    expect(d.refreshLeaderboard).not.toHaveBeenCalled();
    expect((d.createSpot as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      p_gps_source: "manual",
      p_date_source: "upload",
      p_taken_at: null,
    });
  });

  it("erreur inattendue : 500 sans détail interne", async () => {
    const d = deps({
      loadSpot: vi.fn(async () => {
        throw new Error("secret interne");
      }),
    });
    const response = await handlePublishRequest(post(body), d);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });

  it("n'accepte que POST", async () => {
    expect((await handlePublishRequest(new Request("https://exemple.test", { method: "GET" }), deps())).status).toBe(405);
  });
});
