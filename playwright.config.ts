import { defineConfig, devices } from "@playwright/test";

/**
 * Bout en bout. Après un déploiement, PLAYWRIGHT_BASE_URL pointe vers la
 * production : ces tests doivent donc rester en lecture seule.
 * Sinon, la build locale est démarrée (port 3000, ou PLAYWRIGHT_PORT), branchée
 * sur un faux Supabase (e2e/support/supabase-mock.mjs) qui sert les lectures de
 * la carte et des fiches : aucune donnée réelle, aucun réseau.
 */
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const mockPort = Number(process.env.SUPABASE_MOCK_PORT ?? 54329);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
// Navigateur déjà installé ailleurs (ex. conteneur de dev) : chemin explicite.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "off",
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      // WebGL logiciel pour MapLibre en mode sans affichage.
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : [
        {
          command: `node e2e/support/supabase-mock.mjs ${mockPort}`,
          url: `http://127.0.0.1:${mockPort}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: `npm run start -- -p ${port}`,
          // Page d'accueil : toujours servie, même sans données.
          url: `http://localhost:${port}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            SUPABASE_URL: `http://127.0.0.1:${mockPort}`,
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_faux_supabase_local",
            APP_ENV: "local",
          },
        },
      ],
});
