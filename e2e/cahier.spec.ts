import { expect, test } from "@playwright/test";
import { usesMockData } from "./support/demo";

/** Cahier des charges V1.1 : pages légales, onglet Stats. */
test.use({ serviceWorkers: "block" });

for (const [path, title] of [
  ["/confidentialite", "Politique de confidentialité"],
  ["/cgu", "Conditions d'utilisation"],
  ["/moderation", "Règles et modération"],
] as const) {
  test(`page légale ${path} : brouillon lisible, liée aux deux autres`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Brouillon");
    const links = page.getByRole("navigation", { name: "Informations légales" }).getByRole("link");
    await expect(links).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("connexion : liens vers les pages légales", async ({ page }) => {
  await page.goto("/login");
  const legal = page.getByRole("navigation", { name: "Informations légales" });
  await expect(legal.getByRole("link", { name: "Confidentialité" })).toHaveAttribute("href", "/confidentialite");
  await legal.getByRole("link", { name: "Règles et modération" }).click();
  await expect(page).toHaveURL(/\/moderation$/);
  await expect(page.getByRole("heading", { level: 2, name: "Signaler un sticker" })).toBeVisible();
});

test("onglet Stats : chiffres mondiaux et lieux les plus rares", async ({ page }) => {
  test.skip(!usesMockData, "données simulées : build locale seulement");
  await page.goto("/stats");
  await expect(page.getByRole("heading", { level: 1, name: "Stats" })).toBeVisible();
  await expect(page.getByTestId("world-stats")).toContainText("7");
  const rarest = page.getByTestId("rarest-places").getByRole("listitem");
  await expect(rarest.first()).toContainText("Mont Blanc");
  await expect(rarest.first()).toContainText("Lieu très rare");
  await expect(page.getByRole("link", { name: "Stats", exact: true })).toHaveAttribute("aria-current", "page");
});
