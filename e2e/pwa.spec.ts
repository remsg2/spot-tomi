import { expect, test } from "@playwright/test";

/** PWA (étape 6) : manifeste, icônes, métadonnées iOS et service worker hors ligne. */

test("manifeste installable : nom, couleurs, affichage autonome et icônes", async ({ page, request }) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");

  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({
    name: "Spot Tomi",
    short_name: "Spot Tomi",
    start_url: "/",
    display: "standalone",
    lang: "fr",
  });
  expect(manifest.theme_color).toMatch(/^#[0-9A-F]{6}$/i);
  expect(manifest.background_color).toMatch(/^#[0-9A-F]{6}$/i);
  const sizes = manifest.icons.map((icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test("métadonnées iOS : icône d'écran d'accueil et mode application", async ({ page, request }) => {
  await page.goto("/");
  const touchIcon = page.locator('link[rel="apple-touch-icon"]');
  await expect(touchIcon).toHaveAttribute("href", /\/icons\/apple-touch-icon\.png/);
  expect((await request.get((await touchIcon.getAttribute("href"))!)).status()).toBe(200);
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content", "Spot Tomi");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
});

test("service worker enregistré, page hors ligne servie sans réseau", async ({ page, context, request }) => {
  test.setTimeout(60_000);
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toContain("javascript");

  await page.goto("/");
  const scriptURL = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.scriptURL ?? null;
  });
  expect(scriptURL).toMatch(/\/sw\.js$/);

  // Le précache est prêt quand la page hors ligne est en cache.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          for (const name of await caches.keys()) {
            const cache = await caches.open(name);
            for (const key of await cache.keys()) if (new URL(key.url).pathname === "/~offline") return true;
          }
          return false;
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  // Une page privée jamais visitée, sans réseau : la page hors ligne la remplace.
  await context.setOffline(true);
  await page.goto("/me");
  await expect(page.getByRole("heading", { level: 1, name: "Hors ligne" })).toBeVisible();
  await context.setOffline(false);
});
