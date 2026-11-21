import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import exifr from "exifr";
import { choosePhoto, expectNoMetadata, GPS_PHOTO, METADATA_NEEDLES, metadataTraces, PLAIN_PHOTO, webpSize } from "./support/photo-checks";

/*
 * Étape 5 : parcours de publication dans un vrai navigateur, sur le banc
 * d'essai /dev/publish (le vrai parcours, services serveur simulés : pas de
 * Supabase en CI). Le critère « le fichier stocké ne contient aucune donnée
 * EXIF » est vérifié ici sur une vraie photo JPEG avec GPS, XMP et ICC.
 * La vraie route /spots/new est testée dans publication-routes.spec.ts.
 */

const isProduction = process.env.EXPECTED_APP_ENV === "production";

type DemoWindow = Window & {
  __spotTomiUpload?: { path: string; type: string; size: number; base64: string };
  __spotTomiPublishInput?: Record<string, unknown>;
};

async function chooseAndReview(page: Page, photo: string) {
  await page.goto("/dev/publish");
  await expect(page.getByRole("heading", { name: "Ta photo du sticker" })).toBeVisible();
  await choosePhoto(page, photo);
  await expect(page.getByRole("list", { name: "Vérification de la photo" })).toBeVisible();
}

async function uploadedWebp(page: Page): Promise<{ path: string; type: string; bytes: Buffer }> {
  const upload = await page.evaluate(() => (window as DemoWindow).__spotTomiUpload);
  expect(upload, "la photo a été envoyée").toBeTruthy();
  return { path: upload!.path, type: upload!.type, bytes: Buffer.from(upload!.base64, "base64") };
}

test("témoin : la photo d'origine contient bien GPS, EXIF, XMP et ICC", async () => {
  const original = readFileSync(GPS_PHOTO);
  expect(metadataTraces(original)).toEqual(METADATA_NEEDLES.map(([name]) => name).filter((name) => name !== "en-tête TIFF (Intel)"));
  expect(await exifr.gps(original)).toEqual({ latitude: expect.closeTo(-54.8019, 4), longitude: expect.closeTo(-68.303, 4) });
});

test.describe("publication d'un sticker (/dev/publish)", () => {
  test.skip(isProduction, "banc d'essai réservé au développement");

  test("photo avec GPS et date : position et date lues avant envoi, WebP stocké sans aucune métadonnée", async ({ page }) => {
    await chooseAndReview(page, GPS_PHOTO);

    // Lecture EXIF dans le navigateur, avant tout envoi.
    await expect(page.getByText("Position GPS de la photo")).toBeVisible();
    await expect(page.getByText("Argentine · 54,80° S, 68,30° O")).toBeVisible();
    await expect(page.getByText("14 mars 2026 à 16:42")).toBeVisible();
    await expect(page.getByText("2026, d'après la date")).toBeVisible();
    await expect(page.getByText("Les données de la photo sont retirées avant publication.")).toBeVisible();
    await expect(page.getByTestId("estimate")).toContainText("195");
    await expect(page.getByTestId("estimate")).toContainText("Premier du pays");
    expect(await page.evaluate(() => (window as DemoWindow).__spotTomiUpload)).toBeUndefined();

    // Nom obligatoire.
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByText("Donne un nom au lieu.")).toBeVisible();
    await page.getByLabel("Nom du lieu").fill("  Panneau   du bout du monde ");
    await page.getByRole("button", { name: "Coller le sticker" }).click();

    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
    await expect(page.getByText("Ushuaïa, Argentine")).toBeVisible();
    await expect(page.getByRole("img", { name: "Sticker de Tomi : +195" })).toBeVisible();
    await expect(page.getByTestId("rank")).toHaveText("Tu passes 2ᵉ du classement");
    await expect(page.getByRole("link", { name: "Voir sur la carte" })).toHaveAttribute("href", /^\/spots\/[0-9a-f-]{36}$/);
    // Croix « Retour à la carte » : quitter l'écran final sans repasser par le parcours.
    await expect(page.getByRole("link", { name: "Retour à la carte" })).toHaveAttribute("href", "/");

    // Le fichier envoyé dans spot-photos/{user_id}/{uuid}.webp.
    const upload = await uploadedWebp(page);
    expect(upload.path).toMatch(/^00000000-0000-4000-8000-000000000001\/[0-9a-f-]{36}\.webp$/);
    expect(upload.type).toBe("image/webp");
    expectNoMetadata(upload.bytes);
    // Orientation EXIF appliquée (4032 × 3024 tournée de 90°), 2048 px au plus.
    expect(webpSize(upload.bytes)).toEqual({ width: 1536, height: 2048 });

    // Ce que reçoit l'Edge Function publish-spot (contrat §4).
    expect(await page.evaluate(() => (window as DemoWindow).__spotTomiPublishInput)).toEqual({
      photoPath: upload.path,
      lat: -54.8019,
      lng: -68.303,
      altitude: 25.5,
      takenAt: "2026-03-14T19:42:00.000Z",
      gpsSource: "exif",
      dateSource: "exif",
      name: "Panneau du bout du monde",
    });
  });

  test("sans encodeur WebP natif (Safari), libwebp en WebAssembly produit un WebP propre", async ({ page }) => {
    // Comme Safari : toBlob("image/webp") renvoie du PNG.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        return original.call(this, callback, type === "image/webp" ? "image/png" : type, quality);
      };
    });
    await chooseAndReview(page, GPS_PHOTO);
    await page.getByLabel("Nom du lieu").fill("Ushuaïa, panneau");
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible({ timeout: 30_000 });
    const upload = await uploadedWebp(page);
    expect(upload.type).toBe("image/webp");
    expectNoMetadata(upload.bytes);
    expect(webpSize(upload.bytes)).toEqual({ width: 1536, height: 2048 });
  });

  test("photo sans GPS ni date : placée sur la carte, sticker en attente", async ({ page }) => {
    // Zoom clavier instantané (MapLibre suit prefers-reduced-motion).
    await page.emulateMedia({ reducedMotion: "reduce" });
    await chooseAndReview(page, PLAIN_PHOTO);
    await expect(page.getByText("Pas de GPS dans la photo : place-le sur la carte")).toBeVisible();
    await expect(page.getByText("Absente de la photo : date d'envoi")).toBeVisible();
    await expect(page.getByText(/un modérateur vérifie le sticker/)).toBeVisible();
    await page.getByLabel("Nom du lieu").fill("Boîte aux lettres");

    // Sans position, « Coller le sticker » ouvre le sélecteur.
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByText("Place le sticker sur la carte.")).toBeVisible();
    const pane = page.getByTestId("picker-pane");
    await expect(pane).toBeVisible();
    const place = pane.getByRole("button", { name: "Placer le sticker ici" });
    await expect(place).toBeDisabled();

    // Zoom jusqu'à la rue (clavier sur la carte), puis placement.
    await expect(pane.locator("canvas")).toBeVisible({ timeout: 20_000 });
    await pane.locator("canvas").focus();
    for (let i = 0; i < 13; i += 1) await page.keyboard.press("Equal");
    await expect(place).toBeEnabled({ timeout: 20_000 });
    await place.click();

    await expect(page.getByText(/placée à la main/)).toBeVisible();
    await expect(page.getByTestId("estimate")).toContainText("Points en attente de validation");
    await page.getByRole("button", { name: "Coller le sticker" }).click();

    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Sticker de Tomi : En attente" })).toBeVisible();
    await expect(page.getByText("Tes points compteront dès qu'un modérateur aura validé le sticker.")).toBeVisible();
    await expect(page.getByTestId("rank")).toHaveCount(0);

    const input = await page.evaluate(() => (window as DemoWindow).__spotTomiPublishInput);
    expect(input).toMatchObject({ gpsSource: "manual", dateSource: "upload", takenAt: null, altitude: null });
    expectNoMetadata((await uploadedWebp(page)).bytes);
  });

  test("photo prise dans l'app sans GPS (Safari sur iPhone) : position et heure du téléphone, publiée", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -54.8019, longitude: -68.303, accuracy: 15 });
    await page.goto("/dev/publish");
    const camera = page.getByTestId("photo-camera");
    await expect(camera).toBeEnabled();
    await camera.setInputFiles(PLAIN_PHOTO);
    await expect(page.getByRole("list", { name: "Vérification de la photo" })).toBeVisible();

    await expect(page.getByText("Position du téléphone (photo prise à l'instant)")).toBeVisible();
    await expect(page.getByText("Argentine · 54,80° S, 68,30° O")).toBeVisible();
    await expect(page.getByText("Photo prise à l'instant", { exact: true })).toBeVisible();
    await expect(page.getByText(/un modérateur vérifie le sticker/)).toHaveCount(0);
    await expect(page.getByTestId("estimate")).toContainText("195");

    await page.getByLabel("Nom du lieu").fill("Panneau du port");
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible({ timeout: 30_000 });
    const input = await page.evaluate(() => (window as DemoWindow).__spotTomiPublishInput);
    expect(input).toMatchObject({ gpsSource: "device", dateSource: "device", takenAt: null, lat: -54.8019, lng: -68.303 });
    expectNoMetadata((await uploadedWebp(page)).bytes);
  });

  test("photo prise dans l'app, position refusée : à placer sur la carte, en attente", async ({ page }) => {
    await page.goto("/dev/publish");
    const camera = page.getByTestId("photo-camera");
    await expect(camera).toBeEnabled();
    await camera.setInputFiles(PLAIN_PHOTO);
    await expect(page.getByText("Pas de GPS dans la photo : place-le sur la carte")).toBeVisible();
    // La date reste celle de la prise (à l'instant) ; la position manuelle impose la modération.
    await expect(page.getByText("Photo prise à l'instant", { exact: true })).toBeVisible();
    await expect(page.getByText(/un modérateur vérifie le sticker/)).toBeVisible();
  });

  test("photo de la galerie sans GPS : la position du téléphone n'est pas utilisée", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -54.8019, longitude: -68.303, accuracy: 15 });
    await chooseAndReview(page, PLAIN_PHOTO);
    await expect(page.getByText("Pas de GPS dans la photo : place-le sur la carte")).toBeVisible();
    await expect(page.getByText("Absente de la photo : date d'envoi")).toBeVisible();
  });

  test("format non pris en charge : message clair", async ({ page }) => {
    await page.goto("/dev/publish");
    await choosePhoto(page, "e2e/fixtures/webp-propre.webp");
    await expect(page.getByText("Format non pris en charge : choisis une photo JPEG, HEIC ou PNG.")).toBeVisible();
  });

  for (const motion of ["no-preference", "reduce"] as const) {
    test(`« Sticker collé » : lignes puis total (${motion === "reduce" ? "affichage direct" : "animé"})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion });
      await chooseAndReview(page, GPS_PHOTO);
      await page.getByLabel("Nom du lieu").fill("Panneau");
      await page.getByRole("button", { name: "Coller le sticker" }).click();
      await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();

      const rows = page.getByTestId("done").locator(".animate-line-in");
      // 5 lignes, le total, le gain de rang.
      await expect(rows).toHaveCount(7);
      const styles = await rows.evaluateAll((nodes) =>
        nodes.map((node) => ({ name: getComputedStyle(node).animationName, opacity: getComputedStyle(node).opacity })),
      );
      if (motion === "reduce") {
        expect(styles.every((style) => style.name === "none" && style.opacity === "1")).toBe(true);
      } else {
        expect(styles.every((style) => style.name === "line-in")).toBe(true);
        // Le total arrive après les lignes : encore invisible au premier instant.
        expect(Number(styles[5].opacity)).toBeLessThan(1);
        await expect(rows.nth(5)).toHaveCSS("opacity", "1", { timeout: 10_000 });
      }
      await expect(page.getByText("195 pts")).toBeVisible();
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    test(`« Sticker collé » en thème ${scheme === "light" ? "clair" : "sombre"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await chooseAndReview(page, GPS_PHOTO);
      await page.getByLabel("Nom du lieu").fill("Panneau");
      await page.getByRole("button", { name: "Coller le sticker" }).click();
      const done = page.getByTestId("done");
      await expect(done).toBeVisible();
      // Clair : fond couleur de l'année du sticker ; sombre : fond de l'app.
      await expect(done).toHaveCSS("background-color", scheme === "light" ? "rgb(93, 176, 67)" : "rgb(14, 14, 16)");
    });
  }
});

test("/spots/new demande d'être connecté", async ({ page }) => {
  test.skip(!process.env.EXPECTED_SUPABASE_HOST, "proxy actif seulement avec Supabase configuré");
  await page.goto("/spots/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fspots%2Fnew$/);
});

test.describe("sur iPhone", () => {
  test.skip(isProduction, "banc d'essai réservé au développement");
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1",
  });

  test("conseils pour garder la position : « Options » puis « Lieu » dans la galerie", async ({ page }) => {
    await page.goto("/dev/publish");
    await expect(page.getByTestId("ios-tip")).toContainText("active « Lieu »");
    await choosePhoto(page, PLAIN_PHOTO);
    await expect(page.getByTestId("ios-location-tip")).toBeVisible();
  });
});
