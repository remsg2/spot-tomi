import { expect, test, type Page, type Request } from "@playwright/test";
import { demoFeatures, inBbox, USHUAIA_ID, usesMockData } from "./support/demo";

/**
 * Carte mondiale (étape 6) : gabarit mobile et web, clair et sombre, chargement
 * par zone visible, filtres, recherche et fluidité avec 5 000 stickers.
 * Le service worker est bloqué ici pour que Playwright voie toutes les requêtes.
 */
test.use({ serviceWorkers: "block" });
test.skip(!usesMockData, "données simulées : build locale seulement");

const isBboxCall = (request: Request) => request.url().includes("/rest/v1/rpc/spots_in_bbox");

async function waitForMap(page: Page) {
  await expect(page.getByTestId("world-map").locator("canvas")).toBeVisible();
}

test.describe("gabarit", () => {
  test("mobile : carte plein écran et barre d'onglets", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mise en page sous 768 px");
    await page.goto("/");
    await waitForMap(page);
    const viewport = page.viewportSize()!;
    expect(viewport.width).toBeLessThan(768);

    const map = await page.getByTestId("shell-map").boundingBox();
    expect(map?.width).toBe(viewport.width);
    await expect(page.getByTestId("shell-column")).toBeHidden();
    const tabs = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(tabs).toBeVisible();
    expect((await tabs.boundingBox())!.y + 70).toBeGreaterThan(viewport.height - 100);
    await expect(page.getByRole("combobox", { name: "Rechercher" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Me localiser" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Filtres" })).toBeVisible();
  });

  test("web : colonne de 440 px à gauche, carte à droite", async ({ page, isMobile }) => {
    test.skip(isMobile, "mise en page à partir de 1024 px");
    await page.goto("/");
    await waitForMap(page);
    const column = (await page.getByTestId("shell-column").boundingBox())!;
    const map = (await page.getByTestId("shell-map").boundingBox())!;
    expect(column.x).toBe(0);
    expect(column.width).toBe(440);
    expect(map.x).toBe(440);
    expect(map.width).toBe(page.viewportSize()!.width - 440);
    // Navigation en haut de la colonne, pas de barre d'onglets en bas.
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav).toHaveCount(1);
    expect((await nav.boundingBox())!.x).toBeLessThan(440);
    await expect(page.getByRole("link", { name: "Ajouter un sticker" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zoomer", exact: true })).toBeVisible();
    await expect(page.getByText("Légende")).toBeVisible();
    // La colonne liste les stickers à l'écran.
    await expect(page.getByTestId("visible-spots").getByRole("link").first()).toBeVisible();
  });

  test("tablette : colonne et carte dès 768 px, sans barre d'onglets", async ({ page, isMobile }) => {
    test.skip(isMobile, "fenêtre redimensionnée en 900 px");
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto("/");
    const column = (await page.getByTestId("shell-column").boundingBox())!;
    expect(column.width).toBe(380);
    await expect(page.getByTestId("shell-map")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ajouter un sticker" })).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`thème ${scheme === "light" ? "clair" : "sombre"} : jetons et fond de carte`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await waitForMap(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      const water = await page
        .getByTestId("world-map")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(water).toBe(scheme === "light" ? "rgb(222, 220, 211)" : "rgb(11, 12, 14)");
      const card = await page
        .getByRole("combobox", { name: "Rechercher" })
        .locator("xpath=..")
        .evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(card).toBe(scheme === "light" ? "rgb(255, 255, 255)" : "rgb(26, 26, 29)");
    });
  }
});

test.describe("données de la carte", () => {
  test("une zone déjà chargée en entier ne redemande rien", async ({ page, isMobile }) => {
    test.skip(isMobile, "zoom au bouton (web)");
    const first = page.waitForRequest(isBboxCall);
    await page.goto("/");
    const body = (await first).postDataJSON();
    expect(body).toMatchObject({ filters: {} });
    expect(body.min_lat).toBeGreaterThanOrEqual(-90);
    expect(body.max_lng).toBeLessThanOrEqual(180);
    await waitForMap(page);
    await page.waitForTimeout(1000);

    const calls: Request[] = [];
    page.on("request", (request) => {
      if (isBboxCall(request)) calls.push(request);
    });
    await page.getByRole("button", { name: "Zoomer", exact: true }).click();
    await page.waitForTimeout(1500);
    expect(calls).toHaveLength(0);
  });

  test("chargement par zone visible : plus petite à chaque zoom, avec anti-rebond", async ({ page, isMobile }) => {
    test.skip(isMobile, "zoom au bouton (web)");
    // Réponses plafonnées (« truncated ») : chaque nouvelle vue doit être redemandée.
    const bodies: { min_lng: number; max_lng: number; min_lat: number; max_lat: number }[] = [];
    await page.route("**/rest/v1/rpc/spots_in_bbox", async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({ json: { type: "FeatureCollection", features: [], truncated: true } });
    });
    await page.goto("/");
    await waitForMap(page);
    await expect.poll(() => bodies.length).toBeGreaterThan(0);
    await page.waitForTimeout(1000);
    await expect(page.getByTestId("map-notice").filter({ visible: true, hasText: "Beaucoup de stickers ici" })).toBeVisible();
    const before = bodies.length;
    const initial = bodies[before - 1];

    // Trois zooms d'affilée : l'anti-rebond n'envoie qu'une requête (deux au plus).
    const zoomIn = page.getByRole("button", { name: "Zoomer", exact: true });
    await zoomIn.evaluate((button: HTMLElement) => {
      for (let i = 0; i < 3; i += 1) button.click();
    });
    await expect.poll(() => bodies.length, { timeout: 10_000 }).toBeGreaterThan(before);
    await page.waitForTimeout(1500);
    expect(bodies.length - before).toBeLessThanOrEqual(2);
    const last = bodies[bodies.length - 1];
    expect(last.max_lng - last.min_lng).toBeLessThan(initial.max_lng - initial.min_lng);
    expect(last.max_lat - last.min_lat).toBeLessThan(initial.max_lat - initial.min_lat);
  });

  test("les filtres deviennent les paramètres de spots_in_bbox", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    const chip = page.getByRole("button", { name: "Édition 2025" });
    await expect(chip).toBeVisible();

    let request = page.waitForRequest((r) => isBboxCall(r) && r.postDataJSON().filters?.years?.[0] === 2025);
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    expect((await request).postDataJSON().filters).toEqual({ years: [2025] });

    request = page.waitForRequest((r) => isBboxCall(r) && r.postDataJSON().filters?.rare === true);
    await page.getByRole("button", { name: "Rares" }).first().click();
    expect((await request).postDataJSON().filters).toEqual({ years: [2025], rare: true });
  });

  test("recherche d'une personne : filtre sur ses stickers", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await page.getByRole("combobox", { name: "Rechercher" }).fill("hugo");
    const option = page.getByRole("option", { name: /@Hugo/ });
    await expect(option).toBeVisible();
    const request = page.waitForRequest((r) => isBboxCall(r) && Boolean(r.postDataJSON().filters?.authorId));
    await option.click();
    expect((await request).postDataJSON().filters).toEqual({ authorId: "00000000-0000-4000-8000-0000000000a3" });
    await expect(page.getByRole("button", { name: "Retirer le filtre @Hugo" }).first()).toBeVisible();
  });

  test("recherche d'un lieu sans accent : la fiche s'ouvre (colonne en web, tiroir sur mobile)", async ({ page }) => {
    await page.goto("/");
    await waitForMap(page);
    await page.getByRole("combobox", { name: "Rechercher" }).fill("ushuaia");
    const option = page.getByRole("option", { name: /Ushuaïa/ }).first();
    await expect(option).toBeVisible();
    await option.click();

    await expect(page).toHaveURL(new RegExp(`/spots/${USHUAIA_ID}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  });

  test("« Me localiser » centre la carte sur la position", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
    await page.goto("/");
    await waitForMap(page);
    await page.getByRole("button", { name: "Me localiser" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Localisation" })).toBeVisible();
  });
});

test.describe("performance", () => {
  test("5 000 stickers : marqueurs en couches GL et déplacement fluide", async ({ page, isMobile }, testInfo) => {
    test.skip(isMobile, "mesure faite une fois, en web");
    test.setTimeout(90_000);
    const features = demoFeatures(5000);
    let served = 0;
    await page.route("**/rest/v1/rpc/spots_in_bbox", async (route) => {
      const collection = inBbox(features, route.request().postDataJSON());
      served = Math.max(served, collection.features.length);
      await route.fulfill({ json: collection });
    });

    await page.goto("/");
    await waitForMap(page);
    await expect(page.getByRole("status").filter({ hasText: /stickers à l'écran/ })).toContainText(/\d{2,} stickers/, {
      timeout: 15_000,
    });
    expect(served).toBeGreaterThan(4000);
    // Aucun marqueur DOM : tout est dessiné par MapLibre.
    expect(await page.locator(".maplibregl-marker").count()).toBe(0);

    async function measure(label: string) {
      const canvas = (await page.getByTestId("world-map").boundingBox())!;
      const cx = canvas.x + canvas.width / 2;
      const cy = canvas.y + canvas.height / 2;
      await page.evaluate(() => {
        const w = window as unknown as { __frames: number[]; __stop: boolean };
        w.__frames = [];
        w.__stop = false;
        const tick = (time: number) => {
          w.__frames.push(time);
          if (!w.__stop) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      for (let pass = 0; pass < 3; pass += 1) {
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        for (let step = 1; step <= 40; step += 1) {
          await page.mouse.move(cx + (pass % 2 ? -1 : 1) * step * 6, cy + step * 2);
        }
        await page.mouse.up();
      }
      const frames = await page.evaluate(() => {
        const w = window as unknown as { __frames: number[]; __stop: boolean };
        w.__stop = true;
        return w.__frames;
      });
      const gaps = frames.slice(1).map((t, i) => t - frames[i]);
      const duration = frames[frames.length - 1] - frames[0];
      const fps = Math.round(((frames.length - 1) / duration) * 1000);
      const sorted = [...gaps].sort((a, b) => a - b);
      const p95 = Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0);
      const result = `${label} : ${fps} i/s en moyenne, 95e centile ${p95} ms entre deux images (${frames.length} images)`;
      testInfo.annotations.push({ type: "performance", description: result });
      console.log(`[perf] ${result}`);
      return fps;
    }

    const worldFps = await measure("vue monde, pastilles de regroupement");
    const zoomIn = page.getByRole("button", { name: "Zoomer", exact: true });
    for (let i = 0; i < 4; i += 1) {
      await zoomIn.click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1500);
    const zoomedFps = await measure("zoom 5 sur l'Europe, marqueurs individuels");
    // Rendu logiciel (SwiftShader) en conteneur : seuil bas, la mesure est consignée.
    expect(worldFps).toBeGreaterThan(5);
    expect(zoomedFps).toBeGreaterThan(5);
  });
});
