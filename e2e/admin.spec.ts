import { expect, test, type Page } from "@playwright/test";

const isProduction = process.env.EXPECTED_APP_ENV === "production";

/*
 * Mode admin (étape 8). Ces tests restent en lecture seule : ils tournent aussi
 * contre la production. Sans session admin simulable (pas de Supabase Auth en
 * local), la partie client de l'onglet Couleur est testée sur /dev/admin, avec
 * des données d'exemple et une action simulée.
 */

test("l'admin demande une connexion", async ({ page }) => {
  await page.goto("/admin/season");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fseason/);
});

test("la couleur de l'année est posée au runtime sur --year", async ({ page }) => {
  await page.goto("/");
  const style = page.locator("style[data-year-color]");
  await expect(style).toHaveCount(1);
  const color = await style.getAttribute("data-year-color");
  expect(color).toMatch(/^#[0-9A-F]{6}$/);
  const year = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--year").trim().toUpperCase(),
  );
  expect(year).toBe(color);
});

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

async function previewColors(page: Page) {
  return page.locator("[data-season-preview]").evaluate((preview) => {
    const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : null);
    return {
      sticker: bg(preview.querySelector("[data-sticker] > div")),
      button: bg(preview.querySelector('[data-preview="button"]')),
      points: getComputedStyle(preview.querySelector('[data-preview="points"]')!).color,
    };
  });
}

const appYear = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--year").trim().toUpperCase());

test.describe("onglet Couleur (partie client, /dev/admin)", () => {
  test.skip(isProduction, "page réservée au développement");

  test.beforeEach(async ({ page }) => {
    await page.goto("/dev/admin");
    await expect(page.getByRole("heading", { name: "Couleur de l'année 2027" })).toBeVisible();
  });

  test("l'aperçu se recolore en direct, sans toucher au reste de l'app", async ({ page }) => {
    const before = await appYear(page);
    expect(await previewColors(page)).toEqual({ sticker: rgb("#5DB043"), button: rgb("#5DB043"), points: rgb("#5DB043") });

    await page.getByRole("button", { name: "Corail" }).click();
    await expect(page.getByRole("button", { name: "Corail" })).toHaveAttribute("aria-pressed", "true");
    expect(await previewColors(page)).toEqual({ sticker: rgb("#FF7A59"), button: rgb("#FF7A59"), points: rgb("#FF7A59") });

    await page.getByRole("textbox", { name: /Code de la couleur/ }).fill("2ec4b6");
    await expect(page.getByRole("button", { name: "Turquoise" })).toHaveAttribute("aria-pressed", "true");
    expect((await previewColors(page)).sticker).toBe(rgb("#2EC4B6"));
    await expect(page.getByText("Texte noir lisible sur cette couleur")).toBeVisible();
    await expect(page.getByText(/Contraste du texte noir : 8,71:1/)).toBeVisible();

    expect(await appYear(page)).toBe(before);
  });

  test("« Appliquer » est désactivé pour une couleur trop sombre", async ({ page }) => {
    const apply = page.getByRole("button", { name: "Appliquer" });
    await expect(apply).toBeEnabled();

    // L'annonceur de route de Next a aussi le rôle alert : on filtre par texte.
    const colorAlert = page.getByRole("alert").filter({ hasText: /Contraste insuffisant|Couleur invalide/ });

    await page.getByRole("textbox", { name: /Code de la couleur/ }).fill("#1D4ED8");
    await expect(apply).toBeDisabled();
    await expect(colorAlert).toContainText("Contraste insuffisant (2,82:1, minimum 4,5:1)");

    await page.getByRole("textbox", { name: /Code de la couleur/ }).fill("#12");
    await expect(apply).toBeDisabled();
    await expect(colorAlert).toContainText("Couleur invalide");

    await page.getByRole("button", { name: "Jaune" }).click();
    await expect(apply).toBeEnabled();
    await expect(colorAlert).toHaveCount(0);
  });

  test("« Appliquer » recolore toute l'app", async ({ page }) => {
    await page.getByRole("button", { name: "Lilas" }).click();
    await page.getByRole("button", { name: "Appliquer" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Couleur 2027 appliquée" })).toBeVisible();
    await expect.poll(() => appYear(page)).toBe("#A78BFA");
  });

  test("les années de stickers sans couleur sont en alerte", async ({ page }) => {
    await page.getByRole("button", { name: "Choisir la couleur de 2019" }).click();
    await expect(page.getByRole("heading", { name: "Couleur de l'année 2019" })).toBeVisible();
    await page.getByRole("button", { name: "Modifier la couleur de 2025" }).click();
    await expect(page.getByRole("heading", { name: "Couleur de l'année 2025" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Code de la couleur/ })).toHaveValue("#FF7A59");
  });

  test("les actions de modération envoient le bon formulaire", async ({ page }) => {
    const card = page.locator("article").filter({ hasText: "Fourvière · Bea" });
    await expect(card.getByText("Signalé 2 fois")).toBeVisible();
    await card.getByRole("button", { name: "Masquer" }).click();
    await expect(card.getByRole("status")).toHaveText("Simulation : hide");

    await card.getByText("Photo, position et signalements").click();
    await expect(card.getByText("Photo floue")).toBeVisible();
    await expect(card.getByText("45.76230, 4.82270")).toBeVisible();
    // Envoi immédiat au changement ; la simulation ne change rien, la case revient à son état.
    await card.getByRole("checkbox", { name: /Site remarquable/ }).click();
    await expect(card.getByRole("status")).toHaveText("Simulation : site remarquable");

    // Catégorie de rareté imposée : motif obligatoire.
    await card.getByRole("combobox").selectOption("tres_rare");
    await card.getByRole("textbox", { name: "Motif (obligatoire)" }).fill("Sommet à 4 000 m vérifié");
    await card.getByRole("button", { name: "Appliquer" }).click();
    await expect(card.getByRole("status")).toHaveText("Simulation : catégorie tres_rare");
  });

  test("recadrage de l'aperçu par un modérateur", async ({ page }) => {
    const card = page.locator("article").filter({ hasText: "Fourvière · Bea" });
    // Vignette centrée sur le repère actuel (30 %, 70 %).
    await expect(card.locator("img").first()).toHaveCSS("object-position", "30% 70%");
    await card.getByText("Photo, position et signalements").click();
    const editor = card.getByTestId("focus-editor");
    await expect(editor.getByRole("heading", { name: "Où est le sticker sur la photo ?" })).toBeVisible();
    await expect(editor.getByTestId("focus-marker")).toBeVisible();
    const save = editor.getByRole("button", { name: "Enregistrer le cadrage" });
    await expect(save).toBeDisabled();
    await editor.getByRole("button", { name: "Effacer le repère" }).click();
    await save.click();
    await expect(editor.getByRole("status")).toHaveText("Simulation : cadrage au centre");
  });

  test("supprimer un sticker demande une confirmation", async ({ page }) => {
    const card = page.locator("article").filter({ hasText: "Tour Eiffel · Nico" });
    await expect(card.getByText("Sans GPS · points en attente")).toBeVisible();
    await card.getByRole("button", { name: "Supprimer" }).click();
    await expect(card.getByText(/Supprimer définitivement ce sticker/)).toBeVisible();
    await card.getByRole("button", { name: "Annuler" }).click();
    await expect(card.getByText(/Supprimer définitivement ce sticker/)).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Supprimer" })).toBeFocused();
  });
});
