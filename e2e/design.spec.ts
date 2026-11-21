import { expect, test } from "@playwright/test";

const isProduction = process.env.EXPECTED_APP_ENV === "production";

test.describe("thème sans flash au chargement", () => {
  // Tout le JavaScript externe est bloqué : seul le script en ligne de
  // next-themes peut poser data-theme, avant tout rendu React.
  test.beforeEach(async ({ page }) => {
    await page.route(/\.js(\?|$)/, (route) => route.abort());
  });

  test("suit le thème sombre du système", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(14, 14, 16)");
  });

  test("respecte le choix enregistré plutôt que le système", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("spot-tomi-theme", "light"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("page /dev/design", () => {
  test.skip(isProduction, "réservée au développement");

  test("affiche chaque composant en clair et en sombre", async ({ page }) => {
    await page.goto("/dev/design");
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
    for (const theme of ["light", "dark"]) {
      const panel = page.locator(`section[data-theme="${theme}"]`);
      await expect(panel.locator("[data-sticker]").first()).toBeVisible();
      await expect(panel.locator("[data-marker-size='26']")).toHaveCount(1);
      await expect(panel.locator("[data-marker-size='34']").first()).toBeVisible();
      await expect(panel.locator("[data-marker-size='44']").first()).toBeVisible();
      await expect(panel.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
    }
  });

  test("changer --year recolore tous les composants", async ({ page }) => {
    await page.goto("/dev/design");
    await page.locator('[data-swatch="#5DB043"]').click();
    const green = "rgb(93, 176, 67)";

    const backgrounds = await page.evaluate(() => {
      const bg = (el: Element | null) => (el ? getComputedStyle(el).backgroundColor : null);
      const panel = document.querySelector('section[data-theme="dark"]')!;
      return {
        sticker: bg(panel.querySelector("[data-sticker] > div")),
        button: bg(panel.querySelector("button.bg-year")),
        addTab: bg(panel.querySelector('a[aria-label="Ajouter un sticker"]')),
      };
    });
    expect(backgrounds).toEqual({ sticker: green, button: green, addTab: green });
  });

  test("signale une couleur trop sombre pour le texte noir", async ({ page }) => {
    await page.goto("/dev/design");
    await page.locator('[data-swatch="#1D4ED8"]').click();
    await expect(page.getByRole("status")).toContainText("insuffisant");
  });
});

test("la page /dev/design est absente en production", async ({ page }) => {
  test.skip(!isProduction, "vérifié seulement contre la production");
  await page.goto("/dev/design");
  await expect(page.getByRole("heading", { name: "Mode clair" })).toHaveCount(0);
});
