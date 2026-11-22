import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { photoPathFor, thumbPathFor, type PublishResult } from "../_shared/publish-contract.ts";
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
    geocode: vi.fn(async () => ({ city: "Ushuaïa", tourist: false })),
    elevation: vi.fn(async () => 812.4),
    createSpot: vi.fn(async () => ({ id: SPOT })),
    replacePhoto: vi.fn(async () => ({ oldPhotoPath: "ancienne.webp", oldThumbPath: null })),
    setFocus: vi.fn(async () => {}),
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
      p_year: null,
      p_comment: null,
      p_tourist: false,
      p_thumb_path: null,
      p_altitude_source: "exif",
      p_photo_hash: null,
    });
    expect(d.elevation).not.toHaveBeenCalled();
    expect(d.refreshLeaderboard).toHaveBeenCalledTimes(1);
    expect(d.removePhoto).not.toHaveBeenCalled();
    // Sans point de cadrage : rien à enregistrer (centre).
    expect(d.setFocus).not.toHaveBeenCalled();
  });

  it("cadrage : le point touché sur la photo est enregistré après la création, sans jamais bloquer", async () => {
    const d = deps();
    const response = await handlePublishRequest(post({ ...body, focus: { x: 0.25, y: 0.8 } }), d);
    expect(response.status).toBe(200);
    expect(d.setFocus).toHaveBeenCalledWith({ p_author: USER, p_spot_id: SPOT, p_x: 0.25, p_y: 0.8 });

    // Un échec du cadrage ne fait pas échouer la publication.
    const failing = deps({ setFocus: vi.fn(async () => Promise.reject(new Error("panne"))) });
    expect((await handlePublishRequest(post({ ...body, focus: { x: 0.5, y: 0.5 } }), failing)).status).toBe(200);

    // Point hors de la photo : entrée refusée.
    const refused = deps();
    expect((await handlePublishRequest(post({ ...body, focus: { x: 1.4, y: 0.5 } }), refused)).status).toBe(400);
    expect(refused.createSpot).not.toHaveBeenCalled();
  });

  it("transmet l'édition, la date saisie, le commentaire, la miniature, l'empreinte et le site touristique", async () => {
    const d = deps({ geocode: vi.fn(async () => ({ city: "Lyon", tourist: true })) });
    const response = await handlePublishRequest(
      post({
        ...body,
        dateSource: "manual",
        takenAt: "2025-08-05T12:00:00.000Z",
        year: 2025,
        comment: "  Collé   avec Léa ",
        thumbPath: thumbPathFor(PATH),
        photoHash: "-123456789",
      }),
      d,
    );
    expect(response.status).toBe(200);
    expect((d.createSpot as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      p_taken_at: "2025-08-05T12:00:00.000Z",
      p_date_source: "manual",
      p_year: 2025,
      p_comment: "Collé avec Léa",
      p_tourist: true,
      p_thumb_path: thumbPathFor(PATH),
      p_photo_hash: "-123456789",
    });
    expect(d.downloadPhoto).toHaveBeenCalledWith(thumbPathFor(PATH));
  });

  it("sans altitude GPS, l'altitude du terrain (service d'élévation) ; sinon jamais inventée", async () => {
    const d = deps();
    await handlePublishRequest(post({ ...body, altitude: null }), d);
    expect((d.createSpot as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      p_altitude_m: 812.4,
      p_altitude_source: "dem",
    });
    const down = deps({ elevation: vi.fn(async () => null) });
    await handlePublishRequest(post({ ...body, altitude: null }), down);
    expect((down.createSpot as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      p_altitude_m: null,
      p_altitude_source: null,
    });
  });

  it("refuse une miniature qui ne correspond pas à la photo", async () => {
    const response = await handlePublishRequest(
      post({ ...body, thumbPath: thumbPathFor(photoPathFor(USER, "9d9d9d9d-3333-4e4e-8f8f-000000000000")) }),
      deps(),
    );
    expect(response.status).toBe(400);
  });

  it("nouvelle photo d'un sticker : contrôle du WebP, remplacement, anciens fichiers supprimés", async () => {
    const d = deps();
    const response = await handlePublishRequest(post({ replaceSpotId: SPOT, photoPath: PATH, photoHash: "42" }), d);
    expect(response.status).toBe(200);
    expect(d.replacePhoto).toHaveBeenCalledWith({
      p_author: USER,
      p_spot_id: SPOT,
      p_photo_path: PATH,
      p_thumb_path: null,
      p_photo_hash: "42",
    });
    expect(d.removePhoto).toHaveBeenCalledWith("ancienne.webp");
    expect(d.createSpot).not.toHaveBeenCalled();
    expect(d.setFocus).not.toHaveBeenCalled();

    // Avec le point du sticker sur la nouvelle photo.
    const framed = deps();
    await handlePublishRequest(post({ replaceSpotId: SPOT, photoPath: PATH, focus: { x: 0.1, y: 0.9 } }), framed);
    expect(framed.setFocus).toHaveBeenCalledWith({ p_author: USER, p_spot_id: SPOT, p_x: 0.1, p_y: 0.9 });

    const late = deps({ replacePhoto: vi.fn(async () => ({ sqlCode: "ST007", message: "Délai dépassé." })) });
    const refused = await handlePublishRequest(post({ replaceSpotId: SPOT, photoPath: PATH }), late);
    expect(refused.status).toBe(409);
    expect((await refused.json()).error.code).toBe("edit_window");
    expect(late.removePhoto).toHaveBeenCalledWith(PATH);
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
      geocode: vi.fn(async () => {
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
    expect((d.createSpot as ReturnType<typeof vi.fn>).mock.calls[0][0].p_tourist).toBe(false);
  });

  it("photo prise dans l'app : sources « device », la date du client n'est jamais transmise", async () => {
    const d = deps();
    const response = await handlePublishRequest(
      post({ ...body, gpsSource: "device", dateSource: "device", takenAt: "2020-01-01T00:00:00Z" }),
      d,
    );
    expect(response.status).toBe(200);
    expect((d.createSpot as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      p_gps_source: "device",
      p_date_source: "device",
      p_taken_at: null,
    });
  });

  it("sticker non publié : pas de rafraîchissement du classement, rang inchangé, date d'envoi", async () => {
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
