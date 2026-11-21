import { expect, test } from "@playwright/test";
import {
  hasLocalBuild,
  ME,
  sessionCookie,
  startMockSupabase,
  startNextServer,
  type MockSupabase,
  type NextServer,
} from "./support/mock-supabase";

/*
 * Étape 7 · vraies routes /leaderboard, /u/[username] et /me, servies par la
 * build locale branchée sur un Supabase simulé (voir support/mock-supabase.ts).
 * Vérifie le câblage : fonctions SQL appelées, paramètres, session, 404.
 */

test.skip(process.env.EXPECTED_APP_ENV === "production", "build locale seulement");
test.skip(!hasLocalBuild(), "lancer « npm run build » d'abord");
test.describe.configure({ mode: "serial" });

let supabase: MockSupabase;
let next: NextServer;

test.beforeAll(async () => {
  supabase = await startMockSupabase();
  next = await startNextServer(supabase.url);
});

test.afterAll(async () => {
  await next?.close();
  await supabase?.close();
});

const rpcCalls = (name: string) =>
  supabase.calls.filter((call) => call.path === `/rest/v1/rpc/${name}`).map((call) => call.body);
const isWeb = () => test.info().project.name === "desktop";

test("visiteur : classement de l'année en cours, aux points", async ({ page }) => {
  supabase.calls.length = 0;
  await page.goto(`${next.url}/leaderboard`);
  const list = page.getByRole("list", { name: "Classement complet" });
  if (isWeb()) {
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Classement 2026");
    await expect(page.getByText("3 participants")).toBeVisible();
    await expect(list.getByRole("link")).toHaveCount(3);
  } else {
    await expect(page.getByRole("list", { name: "Podium" }).locator("li")).toHaveCount(3);
  }
  await expect(page.locator('li[data-podium-rank="1"], li:has(a[aria-label^="1er"])').first()).toContainText("Lea");
  // Aucun utilisateur mis en avant pour un visiteur.
  await expect(page.locator("a[data-me]")).toHaveCount(0);
  expect(rpcCalls("get_leaderboard")).toContainEqual({ p_period: "2026", p_criterion: "points", p_limit: 50, p_user: null });
  expect(rpcCalls("leaderboard_size")).toContainEqual({ p_period: "2026" });
  // Avatar : URL publique du Storage, calculée au runtime.
  const avatar = page.locator(`img[src*="/storage/v1/object/public/avatars/"]`).first();
  await expect(avatar).toHaveAttribute("src", /^http:\/\/127\.0\.0\.1:\d+\/storage\/v1\/object\/public\/avatars\/.+\/avatar\.webp$/);
});

test("paramètres d'URL : depuis toujours, par pays", async ({ page }) => {
  supabase.calls.length = 0;
  await page.goto(`${next.url}/leaderboard?periode=toujours&critere=pays`);
  await expect(page.getByRole("group", { name: "Critère" }).getByRole("link", { name: "Pays" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(rpcCalls("get_leaderboard")).toContainEqual({ p_period: "all", p_criterion: "countries", p_limit: 50, p_user: null });
});

test("profil public : pseudo sans tenir compte de la casse, stickers publiés", async ({ page }) => {
  supabase.calls.length = 0;
  await page.goto(`${next.url}/u/lea`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lea");
  await expect(page.getByText("Depuis 2024")).toBeVisible();
  await expect(page.getByText("2ᵉ au classement")).toBeVisible();
  await expect(page.locator('[data-album-tile="conquered"]')).toHaveCount(2);
  await expect(page.locator('[data-album-tile="locked"]')).toHaveCount(4);
  await expect(page.locator("li[data-spot-year]")).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Réglages" })).toHaveCount(0);
  const lookup = supabase.calls.find((call) => call.path === "/rest/v1/public_profiles");
  expect(lookup?.search.get("username")).toBe("ilike.lea");
});

test("profil public : le _ d'un pseudo n'est pas un joker", async ({ page }) => {
  await page.goto(`${next.url}/u/tomi_fan`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("tomi_fan");
});

test("pseudo inconnu : page « Profil introuvable » non indexée", async ({ page }) => {
  await page.goto(`${next.url}/u/personne`);
  await expect(page.getByRole("heading", { name: "Profil introuvable" })).toBeVisible();
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("link", { name: "Voir le classement" })).toHaveAttribute("href", "/leaderboard");
});

test("/me sans session : connexion puis retour", async ({ page }) => {
  await page.goto(`${next.url}/me`);
  await expect(page).toHaveURL(/\/login\?next=%2Fme$/);
});

test.describe("connecté", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ ...sessionCookie(supabase.url), url: next.url }]);
  });

  test("/me : profil, rôle, réglages et stickers en attente", async ({ page }) => {
    supabase.calls.length = 0;
    await page.goto(`${next.url}/me`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remi");
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Réglages" })).toHaveAttribute("href", "/me/settings");
    await expect(page.getByText("1er au classement")).toBeVisible();
    await expect(page.locator('li[data-spot-status="pending_review"]')).toContainText("En attente");
    await expect(page.locator("section#album")).toBeVisible();
    expect(rpcCalls("profile_stats")).toContainEqual({ p_user: ME });
  });

  test("/me/settings : bouton retour vers le profil", async ({ page }) => {
    await page.goto(`${next.url}/me/settings`);
    const back = page.getByRole("link", { name: "Retour au profil" });
    await expect(back).toHaveAttribute("href", "/me");
    await back.click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remi");
  });

  test("/me/settings : réglage « Vibrations » gardé sur l'appareil", async ({ page }) => {
    await page.goto(`${next.url}/me/settings`);
    const toggle = page.getByRole("switch", { name: "Vibrations" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(await page.evaluate(() => localStorage.getItem("spot-tomi:vibrations"))).toBe("off");
    await page.reload();
    await expect(page.getByRole("switch", { name: "Vibrations" })).toHaveAttribute("aria-checked", "false");
  });

  test("/u/<pseudo> : bouton retour, vers le classement à l'ouverture directe", async ({ page }) => {
    await page.goto(`${next.url}/u/Lea`);
    const back = page.getByTestId("back-link").filter({ visible: true });
    await expect(back).toHaveAccessibleName("Retour");
    await back.click();
    await expect(page).toHaveURL(/\/leaderboard$/);
  });

  test("/u/<soi-même> : vue publique, sans les stickers en attente", async ({ page }) => {
    await page.goto(`${next.url}/u/Remi`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remi");
    await expect(page.locator('li[data-spot-status="pending_review"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  });

  test("classement : sa ligne mise en avant, et demandée à la base", async ({ page }) => {
    supabase.calls.length = 0;
    await page.goto(`${next.url}/leaderboard`);
    if (isWeb()) {
      const me = page.locator("a[data-me]");
      await expect(me).toContainText("Remi · toi");
      await expect(me).toHaveAttribute("href", "/me");
    } else {
      await expect(page.locator('li[data-podium-rank="2"]')).toContainText("Remi · toi");
    }
    expect(rpcCalls("get_leaderboard")).toContainEqual({ p_period: "2026", p_criterion: "points", p_limit: 50, p_user: ME });
  });

  test("onglet Album : /me#album descend jusqu'à l'album", async ({ page }) => {
    await page.goto(`${next.url}/me#album`);
    // L'album est en haut de l'écran, ou la page est descendue au maximum.
    await expect
      .poll(() =>
        page.locator("#album").evaluate((el) => {
          const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
          return window.scrollY > 0 && (el.getBoundingClientRect().top < 40 || atBottom);
        }),
      )
      .toBe(true);
  });
});
