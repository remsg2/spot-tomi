import { expect, test } from "@playwright/test";
import { MONT_BLANC_ID, USHUAIA_ID, usesMockData } from "./support/demo";

/** Fiche lieu (étape 6), rendue côté serveur à partir du faux Supabase. */
test.use({ serviceWorkers: "block" });
test.skip(!usesMockData, "données simulées : build locale seulement");

// Pendant le streaming, React peut garder un instant une copie cachée du contenu : on ne vise que le visible.
const sheet = (page: import("@playwright/test").Page) => page.getByTestId("spot-sheet").filter({ visible: true });

test("fiche conforme à la maquette : badges, points et détail", async ({ page }) => {
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  await expect(sheet(page)).toContainText("Ushuaïa, Argentine");
  await expect(sheet(page).getByText("2025", { exact: true })).toBeVisible();
  await expect(sheet(page).getByText("Premier sticker du pays", { exact: true }).first()).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: "Remi" })).toHaveAttribute("href", "/u/Remi");
  await expect(sheet(page).getByText("14 mars 2025")).toBeVisible();
  await expect(sheet(page)).toContainText("Pays lointain, premier sticker");
  await expect(sheet(page)).toContainText("+195");

  const lines = sheet(page).getByRole("listitem");
  await expect(lines).toHaveCount(5);
  await expect(sheet(page).getByRole("link", { name: "Comment sont calculés les points ?" })).toHaveAttribute(
    "href",
    "/points",
  );
  await expect(lines.nth(0)).toContainText("Pays lointain");
  await expect(lines.nth(0)).toContainText("25");
  await expect(lines.nth(4)).toContainText("Loin de chez toi");
  await expect(lines.nth(4)).toContainText("+65");

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

test("lieu exceptionnel : badge doré avec l'altitude", async ({ page }) => {
  await page.goto(`/spots/${MONT_BLANC_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Mont Blanc" })).toBeVisible();
  await expect(sheet(page)).toContainText("Lieu exceptionnel · 4 808 m");
  await expect(sheet(page)).toContainText("Pays courant");
});

test("mobile : fiche plein écran, retour à la carte, sans barre d'onglets", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mise en page sous 768 px");
  await page.goto(`/spots/${USHUAIA_ID}`);
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navigation principale" })).toHaveCount(0);
  await expect(page.getByTestId("shell-map").filter({ visible: true })).toHaveCount(0);
  const box = (await sheet(page).boundingBox())!;
  expect(box.width).toBe(page.viewportSize()!.width);
  await page.getByRole("link", { name: "Retour à la carte" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("world-map")).toBeVisible();
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
    "Ushuaïa, Argentine · par Remi · +195 pts",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /spot-photos/);
});

test("sticker inconnu : page introuvable", async ({ page }) => {
  await page.goto("/spots/00000000-0000-4000-8000-0000000000ff");
  await expect(page.getByRole("heading", { level: 1, name: "Sticker introuvable" })).toBeVisible();
  await page.goto("/spots/pas-un-identifiant");
  await expect(page.getByRole("heading", { level: 1, name: "Sticker introuvable" })).toBeVisible();
});
