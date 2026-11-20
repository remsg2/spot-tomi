import { expect, test } from "@playwright/test";

type Health = {
  status: string;
  appEnv: string;
  buildId: string;
  supabaseHost?: string;
  schemaVersion?: string | null;
};

test("la page d'accueil s'affiche en français", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Spot Tomi/);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SPOT TOMI");
});

test("la configuration est lue au runtime, pas au build", async ({ page, request }) => {
  const health = (await (await request.get("/api/health")).json()) as Health;
  expect(health.buildId).toBeTruthy();

  if (process.env.EXPECTED_APP_ENV) {
    expect(health.appEnv).toBe(process.env.EXPECTED_APP_ENV);
  }
  if (process.env.EXPECTED_BUILD_ID) {
    expect(health.buildId).toBe(process.env.EXPECTED_BUILD_ID);
  }
  if (process.env.EXPECTED_SUPABASE_HOST) {
    expect(health.supabaseHost).toBe(process.env.EXPECTED_SUPABASE_HOST);
    expect(health.status).toBe("ok");
    expect(health.schemaVersion).toBeTruthy();
  }

  // La configuration arrive dans le HTML…
  await page.goto("/");
  const runtimeEnv = page.locator("#spot-tomi-runtime-env");
  await expect(runtimeEnv).toHaveCount(1);
  const injected = JSON.parse((await runtimeEnv.textContent()) ?? "{}");
  expect(injected.appEnv ?? injected.env?.appEnv).toBe(health.appEnv);

  // … mais jamais dans les fichiers JS servis au navigateur.
  const scripts = await page.locator("script[src]").evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLScriptElement).src),
  );
  expect(scripts.length).toBeGreaterThan(0);
  const needles = [health.supabaseHost, injected.env?.supabaseKey].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  for (const src of scripts) {
    const body = await (await request.get(src)).text();
    expect(body).not.toMatch(/[a-z0-9-]{10,}\.supabase\.(co|in)/);
    for (const needle of needles) expect(body.includes(needle), src).toBe(false);
  }
});
