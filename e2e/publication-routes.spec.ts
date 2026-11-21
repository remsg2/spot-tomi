import { expect, test, type BrowserContext } from "@playwright/test";
import { inspectWebp } from "../supabase/functions/_shared/webp-metadata";
import { ACCESS_TOKEN, hasLocalBuild, ME, sessionCookie, startNextServer, type NextServer } from "./support/mock-supabase";
import {
  EDIT_RADIUS_M,
  ESTIMATE,
  publishResult,
  startPublicationSupabase,
  webpFromMultipart,
  type PublicationSupabase,
} from "./support/mock-supabase-publication";
import { choosePhoto, expectNoMetadata, GPS_PHOTO, metadataTraces } from "./support/photo-checks";

/*
 * Étape 5 · vraie route /spots/new, servie par la build locale branchée sur
 * un Supabase simulé : session et profil côté serveur, puis, depuis le
 * navigateur, estimation (RPC), envoi dans Storage et appel de publish-spot
 * avec le jeton de l'utilisateur. Vérifie aussi qu'aucun octet de la photo
 * d'origine ni de ses métadonnées ne quitte le navigateur.
 */

test.skip(process.env.EXPECTED_APP_ENV === "production", "build locale seulement");
test.skip(!hasLocalBuild(), "lancer « npm run build » d'abord");
test.describe.configure({ mode: "serial" });

let supabase: PublicationSupabase;
let next: NextServer;

test.beforeAll(async () => {
  supabase = await startPublicationSupabase();
  next = await startNextServer(supabase.url);
});

test.afterAll(async () => {
  await next?.close();
  await supabase?.close();
});

test.beforeEach(() => {
  supabase.calls.length = 0;
  supabase.state.estimate = { ...ESTIMATE };
  supabase.state.publish = (body) => ({ status: 200, json: publishResult(body) });
});

async function logIn(context: BrowserContext) {
  await context.addCookies([{ ...sessionCookie(supabase.url), url: next.url }]);
}

const callsTo = (path: string | RegExp) =>
  supabase.calls.filter((call) => (typeof path === "string" ? call.path === path : path.test(call.path)));

test("visiteur : /spots/new renvoie vers la connexion", async ({ page }) => {
  await page.goto(`${next.url}/spots/new`);
  await expect(page).toHaveURL(/\/login\?next=%2Fspots%2Fnew$/);
});

test("connecté : estimation, envoi Storage puis publish-spot, sans jamais envoyer la photo d'origine", async ({ page, context }) => {
  await logIn(context);
  await page.goto(`${next.url}/spots/new`);
  await expect(page.getByRole("heading", { name: "Ta photo du sticker" })).toBeVisible();

  await choosePhoto(page, GPS_PHOTO);
  await expect(page.getByText("Argentine · 54,80° S, 68,30° O")).toBeVisible();
  await expect(page.getByTestId("estimate")).toContainText("195");
  // Rayon d'ajustement lu dans scoring_rules (edit_radius_m) par la page serveur.
  await expect(page.getByTestId("picker-pane")).toContainText(`${EDIT_RADIUS_M} m maximum`);

  // L'estimation, appelée avec le jeton de l'utilisateur et les données EXIF normalisées.
  const [estimate] = callsTo("/rest/v1/rpc/estimate_spot_points");
  expect(estimate.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  expect(JSON.parse(estimate.body.toString("utf8"))).toEqual({
    p_lat: -54.8019,
    p_lng: -68.303,
    p_altitude_m: 25.5,
    p_taken_at: "2026-03-14T19:42:00.000Z",
    p_gps_source: "exif",
    p_date_source: "exif",
  });
  expect(callsTo(/^\/storage\//)).toHaveLength(0);

  await page.getByLabel("Nom du lieu").fill("Panneau du bout du monde");
  await page.getByRole("button", { name: "Coller le sticker" }).click();
  await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
  await expect(page.getByTestId("rank")).toHaveText("Tu passes 2ᵉ du classement");

  // Storage : spot-photos/{user_id}/{uuid}.webp, WebP propre, jeton de l'utilisateur.
  const uploads = callsTo(/^\/storage\/v1\/object\/spot-photos\//);
  expect(uploads).toHaveLength(1);
  const [upload] = uploads;
  const path = upload.path.replace("/storage/v1/object/spot-photos/", "");
  expect(path).toMatch(new RegExp(`^${ME}/[0-9a-f-]{36}\\.webp$`));
  expect(upload.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  const webp = webpFromMultipart(upload.body);
  expectNoMetadata(webp);
  expect(inspectWebp(webp).chunks).toEqual(["VP8 "]);

  // publish-spot : entrée du contrat §4, jeton de l'utilisateur.
  const [publish] = callsTo("/functions/v1/publish-spot");
  expect(publish.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  expect(JSON.parse(publish.body.toString("utf8"))).toEqual({
    photoPath: path,
    lat: -54.8019,
    lng: -68.303,
    altitude: 25.5,
    takenAt: "2026-03-14T19:42:00.000Z",
    gpsSource: "exif",
    dateSource: "exif",
    name: "Panneau du bout du monde",
  });

  // Rien de la photo d'origine (JPEG, EXIF, GPS, XMP, ICC) n'a quitté le navigateur.
  const jpegStart = Buffer.from([0xff, 0xd8, 0xff]);
  for (const call of supabase.calls) {
    expect(metadataTraces(call.body), `${call.method} ${call.path}`).toEqual([]);
    expect(call.body.includes(jpegStart), `${call.method} ${call.path}`).toBe(false);
  }
});

test("refus du serveur : limite quotidienne, message clair et nouvel essai possible", async ({ page, context }) => {
  supabase.state.publish = () => ({
    status: 429,
    json: { error: { code: "daily_limit", message: "Tu as atteint la limite de publications des dernières 24 heures." } },
  });
  await logIn(context);
  await page.goto(`${next.url}/spots/new`);
  await choosePhoto(page, GPS_PHOTO);
  await page.getByLabel("Nom du lieu").fill("Panneau");
  await page.getByRole("button", { name: "Coller le sticker" }).click();
  await expect(page.getByText("Tu as atteint la limite de 20 stickers en 24 heures. Réessaie plus tard.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();

  // Le serveur a supprimé la photo refusée : le nouvel essai la renvoie.
  supabase.state.publish = (body) => ({ status: 200, json: publishResult(body) });
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
  expect(callsTo(/^\/storage\/v1\/object\/spot-photos\//)).toHaveLength(2);
});

test("estimation bloquante : déjà un sticker à moins de 200 m aujourd'hui", async ({ page, context }) => {
  supabase.state.estimate = { ...ESTIMATE, blocked: "nearby_today" };
  await logIn(context);
  await page.goto(`${next.url}/spots/new`);
  await choosePhoto(page, GPS_PHOTO);
  await expect(page.getByText("Tu as déjà collé un sticker à moins de 200 m d'ici ces dernières 24 heures.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Coller le sticker" })).toBeDisabled();
  expect(callsTo(/^\/storage\//)).toHaveLength(0);
});
