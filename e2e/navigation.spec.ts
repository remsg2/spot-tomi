import { expect, test, type Page } from "@playwright/test";
import { USHUAIA_ID } from "./support/demo";

/*
 * Aucune impasse : chaque page sans barre d'onglets ni navigation a un bouton
 * retour. Il revient à la page précédente de l'app quand elle existe, sinon il
 * mène à la page parente (lien partagé, ouverture directe).
 */

const back = (page: Page) => page.getByTestId("back-link").filter({ visible: true });

for (const path of ["/login", "/points", "/~offline"]) {
  test(`${path} : bouton retour`, async ({ page }) => {
    await page.goto(path);
    await expect(back(page)).toHaveCount(1);
    await expect(back(page)).toHaveAccessibleName(/^Retour/);
  });
}

test("adresse inconnue : page 404 avec retour à la carte", async ({ page }) => {
  const response = await page.goto("/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Page introuvable" })).toBeVisible();
  await expect(back(page)).toHaveAttribute("href", "/");
  await page.getByRole("link", { name: "Retour à la carte" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("ouverture directe : le retour mène à la page parente", async ({ page }) => {
  await page.goto("/points");
  await back(page).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
});

test("connexion ouverte depuis le classement : le retour revient au classement", async ({ page }) => {
  await page.goto("/leaderboard");
  await page.goto("/login");
  await back(page).click();
  await expect(page).toHaveURL(/\/leaderboard$/);
});

test("règles ouvertes depuis une fiche : le retour revient à la fiche", async ({ page, isMobile }) => {
  test.skip(process.env.EXPECTED_APP_ENV === "production", "données du Supabase simulé");
  await page.goto(`/spots/${USHUAIA_ID}`);
  // Mobile : la fiche s'ouvre à mi-hauteur dans un tiroir ; plein écran pour lire la suite.
  if (isMobile) await page.getByRole("button", { name: "Agrandir la fiche" }).click();
  await page.getByRole("link", { name: "Comment sont calculés les points ?" }).click();
  await expect(page).toHaveURL(/\/points$/);
  await back(page).click();
  await expect(page).toHaveURL(new RegExp(`/spots/${USHUAIA_ID}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Ushuaïa" })).toBeVisible();
});

test("vibrations : un tic au changement de filtre (API Vibration)", async ({ page }) => {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as Window & { __vibrations?: unknown[] }).__vibrations = calls;
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (pattern: unknown) => (calls.push(pattern), true) });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Rares" }).first().click();
  expect(await page.evaluate(() => (window as Window & { __vibrations?: unknown[] }).__vibrations)).toEqual([8]);
});
