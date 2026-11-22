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
    // Date du collage préremplie avec le jour de la photo, édition proposée d'après l'année.
    await expect(page.getByLabel("Date du collage")).toHaveValue("2026-03-14");
    await expect(page.getByText("Préremplie avec la date de la photo, modifiable.")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Édition 2026/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("Les données de la photo (EXIF, GPS…) sont retirées avant publication.")).toBeVisible();
    await expect(page.getByTestId("public-notice")).toContainText("visibles par tous sur la carte publique");
    // Sticker à moins de 200 m : pas de bonus de rareté, dit avant de publier.
    await expect(page.getByTestId("nearby-warning")).toContainText("Un sticker est déjà collé à 120 m");
    await expect(page.getByTestId("estimate")).toContainText("120");
    await expect(page.getByTestId("estimate")).toContainText("Premier du pays");
    await expect(page.getByTestId("estimate-category")).toHaveText("Lieu touristique");
    expect(await page.evaluate(() => (window as DemoWindow).__spotTomiUpload)).toBeUndefined();

    // Nom obligatoire.
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByText("Donne un nom au lieu.")).toBeVisible();
    await page.getByLabel("Nom du lieu").fill("  Panneau   du bout du monde ");
    await page.getByRole("button", { name: "Coller le sticker" }).click();

    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
    await expect(page.getByText("Ushuaïa, Argentine")).toBeVisible();
    await expect(page.getByRole("img", { name: "Sticker de Tomi : +120" })).toBeVisible();
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

    // Ce que reçoit l'Edge Function publish-spot (contrat §4) : date de la photo inchangée,
    // édition choisie, miniature et empreinte de la photo.
    expect(await page.evaluate(() => (window as DemoWindow).__spotTomiPublishInput)).toEqual({
      photoPath: upload.path,
      lat: -54.8019,
      lng: -68.303,
      altitude: 25.5,
      takenAt: "2026-03-14T19:42:00.000Z",
      gpsSource: "exif",
      dateSource: "exif",
      name: "Panneau du bout du monde",
      year: 2026,
      comment: null,
      thumbPath: upload.path.replace(/\.webp$/, ".thumb.webp"),
      photoHash: expect.stringMatching(/^-?\d{1,20}$/),
      focus: null,
    });
  });

  test("cadrage : toucher le sticker sur la photo entière, envoyé avec la publication", async ({ page }) => {
    await chooseAndReview(page, GPS_PHOTO);
    const picker = page.getByTestId("focus-picker");
    // Fonction mise en avant : titre, « Conseillé », pourquoi, consigne posée sur la photo.
    await expect(picker.getByRole("heading", { name: "Où est ton sticker sur la photo ?" })).toBeVisible();
    await expect(picker.getByText("Conseillé", { exact: true })).toBeVisible();
    await expect(picker.getByText(/la photo est recadrée\. Touche ton sticker/)).toBeVisible();
    await expect(picker.getByTestId("focus-prompt")).toContainText("Touche ton sticker");
    // Aperçu recadré, centré tant qu'aucun repère n'est posé.
    const preview = picker.getByTestId("focus-preview");
    await expect(preview).toContainText("Sans repère, la photo est centrée");
    await expect(preview.locator("img").first()).toHaveCSS("object-position", "50% 50%");
    const photo = picker.getByRole("img", { name: /touche le sticker/ });
    // Photo entière (jamais recadrée ici), en hauteur comme la photo d'origine.
    await expect(photo).toHaveCSS("object-fit", "contain");
    const box = (await photo.boundingBox())!;
    expect(box.height).toBeGreaterThan(box.width);

    await photo.click({ position: { x: box.width * 0.25, y: box.height * 0.75 } });
    await expect(picker.getByTestId("focus-marker")).toBeVisible();
    // La consigne disparaît, l'aperçu suit le repère.
    await expect(picker.getByTestId("focus-prompt")).toHaveCount(0);
    await expect(preview).toContainText("Ton sticker reste dans le cadre.");
    await expect(preview.locator("img").first()).toHaveCSS("object-position", /^2[45](\.\d+)?% 7[45](\.\d+)?%$/);
    // Au clavier : flèches pour ajuster.
    await picker.getByRole("group").focus();
    await page.keyboard.press("ArrowRight");

    await page.getByLabel("Nom du lieu").fill("Panneau");
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
    const input = await page.evaluate(() => (window as DemoWindow).__spotTomiPublishInput);
    const focus = input!.focus as { x: number; y: number };
    expect(focus.x).toBeCloseTo(0.27, 2);
    expect(focus.y).toBeCloseTo(0.75, 2);
  });

  test("cadrage facultatif : « Effacer le repère » remet la consigne", async ({ page }) => {
    await chooseAndReview(page, GPS_PHOTO);
    const picker = page.getByTestId("focus-picker");
    await picker.getByRole("img", { name: /touche le sticker/ }).click();
    await expect(picker.getByTestId("focus-marker")).toBeVisible();
    await picker.getByRole("button", { name: "Effacer le repère" }).click();
    await expect(picker.getByTestId("focus-marker")).toHaveCount(0);
    await expect(picker.getByTestId("focus-prompt")).toBeVisible();
    // « Changer la photo » reste sur la photo et ne place pas de repère.
    await expect(picker.getByRole("button", { name: "Changer la photo" })).toBeVisible();
  });

  test("date du collage et édition modifiables, commentaire facultatif", async ({ page }) => {
    await chooseAndReview(page, GPS_PHOTO);
    const date = page.getByLabel("Date du collage");
    await expect(date).toHaveValue("2026-03-14");

    // Date changée : l'édition proposée suit, tant que le membre ne l'a pas choisie.
    await date.fill("2025-12-31");
    await expect(page.getByRole("radio", { name: /Édition 2025/ })).toHaveAttribute("aria-checked", "true");
    // Édition 2026 collée en 2025 : impossible, dit à l'envoi.
    await page.getByRole("radio", { name: /Édition 2026/ }).click();
    await page.getByLabel("Nom du lieu").fill("Panneau");
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByText("Un sticker de l'édition 2026 ne peut pas avoir été collé avant 2026.")).toBeVisible();
    expect(await page.evaluate(() => (window as DemoWindow).__spotTomiPublishInput)).toBeUndefined();
    await page.getByRole("radio", { name: /Édition 2025/ }).click();
    await expect(page.getByRole("radio", { name: /Édition 2025/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/ne peut pas avoir été collé avant/)).toHaveCount(0);

    // Date dans le futur : refusée.
    await date.fill("2099-01-01");
    await expect(page.getByText("La date du collage ne peut pas être dans le futur.")).toBeVisible();
    await date.fill("2025-12-31");

    await page.getByLabel("Commentaire (facultatif)").fill("  Collé   un soir de neige ");
    await page.getByRole("button", { name: "Coller le sticker" }).click();
    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
    // Jour changé : date saisie (midi UTC), source « manual ».
    expect(await page.evaluate(() => (window as DemoWindow).__spotTomiPublishInput)).toMatchObject({
      takenAt: "2025-12-31T12:00:00.000Z",
      dateSource: "manual",
      year: 2025,
      // Bords retirés ici ; les espaces multiples sont réduits par publish-spot (contrat).
      comment: "Collé   un soir de neige",
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
    await expect(page.getByText("Préremplie avec la date du jour, modifiable.")).toBeVisible();
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

    await expect(page.getByText(/placée à la main/).first()).toBeVisible();
    // Publication directe : publié tout de suite, puis vérifié par un modérateur.
    await expect(page.getByText(/publié tout de suite, puis vérifié par un modérateur/)).toBeVisible();
    await expect(page.getByTestId("estimate")).toContainText("120");
    await page.getByRole("button", { name: "Coller le sticker" }).click();

    await expect(page.getByRole("heading", { name: "Sticker collé !" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Sticker de Tomi : +120" })).toBeVisible();
    await expect(page.getByText("Tes points compteront dès qu'un modérateur aura validé le sticker.")).toHaveCount(0);

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
    await expect(page.getByText("Préremplie avec la date du jour, modifiable.")).toBeVisible();
    await expect(page.getByText(/vérifié par un modérateur/)).toHaveCount(0);
    await expect(page.getByTestId("estimate")).toContainText("120");

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
    // La date du collage est celle du jour ; à placer sur la carte avant de publier.
    await expect(page.getByText("Préremplie avec la date du jour, modifiable.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Placer" })).toBeVisible();
  });

  test("photo de la galerie sans GPS : la position du téléphone n'est pas utilisée", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: -54.8019, longitude: -68.303, accuracy: 15 });
    await chooseAndReview(page, PLAIN_PHOTO);
    await expect(page.getByText("Pas de GPS dans la photo : place-le sur la carte")).toBeVisible();
    await expect(page.getByText("Position du téléphone (photo prise à l'instant)")).toHaveCount(0);
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
      // 2 lignes (base, rareté), le total, le gain de rang.
      await expect(rows).toHaveCount(4);
      const styles = await rows.evaluateAll((nodes) =>
        nodes.map((node) => ({ name: getComputedStyle(node).animationName, opacity: getComputedStyle(node).opacity })),
      );
      if (motion === "reduce") {
        expect(styles.every((style) => style.name === "none" && style.opacity === "1")).toBe(true);
      } else {
        expect(styles.every((style) => style.name === "line-in")).toBe(true);
        // Le total arrive après les lignes : encore invisible au premier instant.
        expect(Number(styles[2].opacity)).toBeLessThan(1);
        await expect(rows.nth(2)).toHaveCSS("opacity", "1", { timeout: 10_000 });
      }
      await expect(page.getByText("120 pts")).toBeVisible();
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
