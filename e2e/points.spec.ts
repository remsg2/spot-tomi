import { expect, test } from "@playwright/test";

test("la page des règles explique le barème avec un exemple chiffré", async ({ page }) => {
  await page.goto("/points");
  await expect(page.getByRole("heading", { level: 1, name: "Comment gagner des points" })).toBeVisible();
  // Barème lu dans la base (scoring_rules) : pas de message de repli.
  await expect(page.getByText("Le barème n'a pas pu être chargé")).toHaveCount(0);
  for (const heading of ["Points de base", "Bonus de rareté", "Niveau des pays", "Règles du jeu"]) {
    await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
  }
  // Indice de rareté : une ligne par catégorie, avec le bonus en vigueur.
  const categories = page.getByTestId("rarity-categories").getByRole("listitem");
  await expect(categories).toHaveCount(5);
  await expect(categories.nth(1)).toContainText("+20");
  await expect(categories.nth(4)).toContainText("+200");
  for (const tier of ["Courant", "Lointain", "Rare", "Extrême"]) {
    await expect(page.getByText(new RegExp(`^${tier} ·`)).first()).toBeVisible();
  }
  // Exemple d'un lieu isolé : 100 de base + 100 de rareté avec le barème par défaut.
  await expect(page.getByRole("heading", { name: "Exemple : les hautes terres d'Islande" })).toBeVisible();
  await expect(page.getByText("+200", { exact: true }).last()).toBeVisible();
  // Aucune trace de l'ancien barème (domicile).
  await expect(page.getByText(/chez toi|domicile/i)).toHaveCount(0);
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
