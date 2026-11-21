import { expect, test } from "@playwright/test";

test("la page des règles explique le barème avec un exemple chiffré", async ({ page }) => {
  await page.goto("/points");
  await expect(page.getByRole("heading", { level: 1, name: "Comment gagner des points" })).toBeVisible();
  // Barème lu dans la base (scoring_rules) : pas de message de repli.
  await expect(page.getByText("Le barème n'a pas pu être chargé")).toHaveCount(0);
  for (const heading of ["Points de base selon le pays", "Bonus cumulables", "Malus et règles du jeu"]) {
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
  for (const tier of ["Courant", "Lointain", "Rare", "Extrême"]) {
    await expect(page.getByText(tier, { exact: true })).toBeVisible();
  }
  // Exemple Ushuaïa (spécifications 3.5) : 195 avec le barème par défaut.
  await expect(page.getByRole("heading", { name: "Exemple : Ushuaïa, Argentine" })).toBeVisible();
  await expect(page.getByText("+195", { exact: true })).toBeVisible();
});

test("le favicon est celui de Tomi", async ({ page, request }) => {
  const response = await request.get("/favicon.ico");
  expect(response.status()).toBe(200);
  const bytes = await response.body();
  // En-tête ICO : réservé 0, type 1 (icône), 3 images (16, 32, 48 px).
  expect([...bytes.subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);

  await page.goto("/points");
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute("href", /favicon\.ico|icon/);
});
