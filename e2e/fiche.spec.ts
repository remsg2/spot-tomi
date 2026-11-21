import { expect, test } from "@playwright/test";
import { MONT_BLANC_ID, TAVEUNI_EST_ID, USHUAIA_ID, usesMockData } from "./support/demo";

/** Fiche lieu (étape 6), rendue côté serveur à partir du faux Supabase. */
test.use({ serviceWorkers: "block" });
test.skip(!usesMockData, "données simulées : build locale seulement");

// Pendant le streaming, React peut garder un instant une copie cachée du contenu : on ne vise que le visible.
const sheet = (page: import("@playwright/test").Page) => page.getByTestId("spot-sheet").filter({ visible: true });

test("fiche conforme à la maquette : badges, points et détail", async ({ page }) => {
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  await expect(sheet(page)).toContainText("Ushuaïa, Argentine");
  await expect(sheet(page).getByTestId("spot-edition")).toHaveText("Édition 2025");
  await expect(sheet(page).getByText("Lieu touristique", { exact: true }).first()).toBeVisible();
  await expect(sheet(page).getByText("Premier sticker du pays", { exact: true }).first()).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: "Remi" })).toHaveAttribute("href", "/u/Remi");
  await expect(sheet(page).getByText("14 mars 2025")).toBeVisible();
  await expect(sheet(page).getByTestId("spot-comment")).toContainText("Au bout du monde, face au canal Beagle.");
  await expect(sheet(page)).toContainText("+120");

  // Barème V1.1 : 100 de base + bonus de rareté (ici, lieu touristique).
  const lines = sheet(page).getByTestId("points-breakdown").getByRole("listitem");
  await expect(lines).toHaveCount(2);
  await expect(sheet(page).getByRole("link", { name: "Comment sont calculés les points ?" })).toHaveAttribute(
    "href",
    "/points",
  );
  await expect(lines.nth(0)).toContainText("Sticker publié");
  await expect(lines.nth(0)).toContainText("100");
  await expect(lines.nth(1)).toContainText("Lieu touristique");
  await expect(lines.nth(1)).toContainText("+20");

  // Toute la fiche prend la couleur de l'année du sticker (2025), pas celle de l'année en cours.
  const year = await sheet(page).evaluate((element) => getComputedStyle(element).getPropertyValue("--year").trim());
  expect(year.toUpperCase()).toBe("#FF7A59");

  // Photo publique du bucket spot-photos.
  await expect(sheet(page).getByRole("img", { name: "Photo du sticker collé à Ushuaïa" })).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/public\/spot-photos\//,
  );
  // Visiteur : ni actions d'auteur, ni signalement.
  await expect(sheet(page).getByRole("button", { name: "Renommer" })).toHaveCount(0);
  await expect(sheet(page).getByRole("button", { name: "Signaler" })).toHaveCount(0);
});

test("stickers les plus proches (50 km), avec la distance, de part et d'autre de l'antiméridien", async ({ page }) => {
  await page.goto(`/spots/${TAVEUNI_EST_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Taveuni est" })).toBeVisible();
  const nearby = sheet(page).getByTestId("nearby-spots").getByRole("link");
  await expect(nearby).toHaveCount(1);
  await expect(nearby).toContainText("Taveuni ouest");
  await expect(nearby).toContainText(/21([,.]\d)? km/);
  // Ushuaïa : personne à moins de 50 km.
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  await expect(sheet(page).getByTestId("nearby-spots")).toHaveCount(0);
});

test("lieu exceptionnel : badge doré avec l'altitude", async ({ page }) => {
  await page.goto(`/spots/${MONT_BLANC_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Mont Blanc" })).toBeVisible();
  await expect(sheet(page)).toContainText("Lieu exceptionnel · 4 808 m");
  await expect(sheet(page).getByText("Lieu très rare", { exact: true }).first()).toBeVisible();
  await expect(sheet(page)).toContainText("+300");
});

/** Glisse la poignée du tiroir (photo) de `dy` pixels. */
async function dragGrip(page: import("@playwright/test").Page, dy: number) {
  // Fin de l'animation du tiroir (300 ms) avant de viser la poignée.
  await page.waitForTimeout(400);
  const grip = page.getByTestId("shell-column").locator("[data-sheet-grip]").first();
  const box = (await grip.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy / 2, { steps: 6 });
  await page.mouse.move(x, y + dy, { steps: 6 });
  await page.mouse.up();
}

test("mobile : fiche dans un tiroir sur la carte, à mi-hauteur puis plein écran, croix pour fermer", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mise en page sous 768 px");
  await page.goto("/");
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  // La carte reste affichée derrière le tiroir, sans barre d'onglets.
  await expect(page.getByTestId("world-map")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
  const drawer = page.getByTestId("shell-column");
  await expect(drawer).toHaveAttribute("data-sheet", "half");
  const box = (await sheet(page).boundingBox())!;
  expect(box.width).toBe(page.viewportSize()!.width);
  expect(box.y).toBeGreaterThan(page.viewportSize()!.height * 0.35);

  // Tirer vers le haut : plein écran ; vers le bas : retour à mi-hauteur.
  await dragGrip(page, -320);
  await expect(drawer).toHaveAttribute("data-sheet", "full");
  await dragGrip(page, 220);
  await expect(drawer).toHaveAttribute("data-sheet", "half");

  await page.getByRole("link", { name: "Fermer la fiche" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("world-map")).toBeVisible();
});

test("mobile : tirer le tiroir vers le bas le ferme", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mise en page sous 768 px");
  await page.goto("/");
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  await dragGrip(page, 400);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toHaveCount(0);
});

test("mobile : lien partagé (ouverture directe), la croix mène à la carte", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mise en page sous 768 px");
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  await page.getByRole("link", { name: "Fermer la fiche" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("web : la fiche s'affiche dans la colonne, la carte à droite", async ({ page, isMobile }) => {
  test.skip(isMobile, "mise en page à partir de 1024 px");
  await page.goto(`/spots/${USHUAIA_ID}`);
  const column = page.getByTestId("shell-column").filter({ visible: true });
  await expect(column.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  expect((await column.boundingBox())!.width).toBe(440);
  await expect(page.getByTestId("world-map").locator("canvas")).toBeVisible();
  await expect(page.getByRole("link", { name: "Carte", exact: true })).toHaveAttribute("aria-current", "page");
});

test("thème sombre de la fiche", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  const background = await sheet(page).evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).toBe("rgb(26, 26, 29)");
});

test("partage par lien : copie quand le partage natif est absent", async ({ page, context, browserName }) => {
  test.skip(browserName !== "chromium", "presse-papiers Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await page.goto(`/spots/${USHUAIA_ID}`);
  await page.getByRole("button", { name: "Partager" }).click();
  await expect(page.getByText("Lien copié").first()).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`/spots/${USHUAIA_ID}`);
});

test("métadonnées Open Graph pour le partage", async ({ page }) => {
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page).toHaveTitle("Ushuaïa · Spot Tomi");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Ushuaïa");
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    "Ushuaïa, Argentine · par Remi · +120 pts",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /spot-photos/);
});

test("sticker inconnu : page introuvable", async ({ page }) => {
  await page.goto("/spots/00000000-0000-4000-8000-0000000000ff");
  await expect(page.getByRole("heading", { level: 1, name: "Sticker introuvable" })).toBeVisible();
  await page.goto("/spots/pas-un-identifiant");
  await expect(page.getByRole("heading", { level: 1, name: "Sticker introuvable" })).toBeVisible();
});
