import { expect, test } from "@playwright/test";

test("la page de connexion propose l'email (Google et Apple désactivés)", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuer avec Apple" })).toHaveCount(0);
  await expect(page.getByLabel("Adresse email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Recevoir un lien de connexion" })).toBeVisible();

  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer un compte" })).toBeVisible();
});

for (const path of ["/me", "/me/settings", "/welcome"]) {
  test(`${path} demande d'être connecté`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
  });
}

test("le retour de connexion refuse une redirection vers un autre site", async ({ request }) => {
  const response = await request.get("/auth/callback?next=https://evil.example", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).not.toContain("evil.example");
});
