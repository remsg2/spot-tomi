import { defineConfig, devices } from "@playwright/test";

/**
 * Bout en bout. Après un déploiement, PLAYWRIGHT_BASE_URL pointe vers la
 * production : ces tests doivent donc rester en lecture seule.
 * Sinon, la build locale est démarrée sur le port 3000.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
// Navigateur déjà installé ailleurs (ex. conteneur de dev) : chemin explicite.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/.claude/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "off",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        // Page d'accueil : /api/health répond 503 sans Supabase configuré.
        url: "http://localhost:3000/",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
