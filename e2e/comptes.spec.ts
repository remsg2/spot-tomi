import { expect, test } from "@playwright/test";

test("la page de connexion : mot de passe d'emblée, code par email en option (Google et Apple désactivés)", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuer avec Apple" })).toHaveCount(0);
  await expect(page.getByLabel("Adresse email")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer un compte" })).toBeVisible();

  await page.getByRole("button", { name: "Recevoir un code par email" }).click();
  await expect(page.getByRole("button", { name: "Recevoir un code par email" })).toHaveAttribute("type", "submit");
  await expect(page.getByLabel("Mot de passe")).toHaveCount(0);
});

test("champs reconnus par les gestionnaires de mots de passe, mode retenu sur l'appareil", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("Adresse email");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Mot de passe")).toHaveAttribute("autocomplete", "current-password");
  // Choix gardé sur l'appareil.
  await page.getByRole("button", { name: "Recevoir un code par email" }).click();
  await page.reload();
  await expect(page.getByLabel("Mot de passe")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Utiliser un mot de passe" })).toBeVisible();
  await page.getByRole("button", { name: "Utiliser un mot de passe" }).click();
  await page.reload();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
});

test("envoi d'emails limité : le formulaire passe au mot de passe, avec une explication", async ({ page }) => {
  await page.route("**/auth/v1/otp**", (route) =>
    route.fulfill({
      status: 429,
      json: { code: "over_email_send_rate_limit", error_code: "over_email_send_rate_limit", msg: "Email rate limit exceeded" },
    }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "Recevoir un code par email" }).click();
  await page.getByLabel("Adresse email").fill("ami@example.test");
  await page.getByRole("button", { name: "Recevoir un code par email" }).click();
  await expect(page.getByText("L'envoi d'emails est limité pour le moment")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer un compte" })).toBeVisible();
});

test("connexion par code : l'email reçoit un code, tapé dans la page qui l'a demandé", async ({ page }) => {
  const sent: unknown[] = [];
  await page.route("**/auth/v1/otp**", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, json: {} });
  });
  await page.route("**/auth/v1/verify**", (route) =>
    route.fulfill({
      status: 403,
      json: { code: "otp_expired", error_code: "otp_expired", msg: "Token has expired or is invalid" },
    }),
  );
  await page.goto("/login");
  await page.getByRole("button", { name: "Recevoir un code par email" }).click();
  await page.getByLabel("Adresse email").fill("ami@example.test");
  await page.getByRole("button", { name: "Recevoir un code par email" }).click();

  await expect(page.getByText("un code à 6 chiffres vient d'être envoyé à ami@example.test")).toBeVisible();
  const code = page.getByLabel("Code reçu par email");
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await expect(code).toHaveAttribute("inputmode", "numeric");
  expect(sent).toHaveLength(1);

  await code.fill("123");
  await page.getByRole("button", { name: "Valider le code" }).click();
  await expect(page.getByText("Le code fait 6 chiffres.")).toBeVisible();

  // Collé depuis l'email avec un espace : accepté.
  await code.fill("123 456");
  await page.getByRole("button", { name: "Valider le code" }).click();
  await expect(page.getByText("Code incorrect ou expiré")).toBeVisible();

  await page.getByRole("button", { name: "Renvoyer un code" }).click();
  await expect.poll(() => sent.length).toBe(2);

  await page.getByRole("button", { name: "Changer d'adresse" }).click();
  await expect(page.getByLabel("Adresse email")).toBeVisible();
  await expect(code).toHaveCount(0);
});

test("ancien choix « lien par email » gardé sur l'appareil : devient le code", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("spot-tomi:connexion", "magic"));
  await page.goto("/login");
  await expect(page.getByLabel("Mot de passe")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Utiliser un mot de passe" })).toBeVisible();
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
