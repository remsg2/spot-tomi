import { expect, test, type Locator, type Page } from "@playwright/test";

/*
 * Étape 7 · mise en page du classement et du profil, sur mobile (Pixel 7) et
 * en web (1280 px), en clair et en sombre. Données simulées : les pages
 * /dev/classement et /dev/profil alimentent les vrais composants par des props.
 */

const isProduction = process.env.EXPECTED_APP_ENV === "production";
const ACCENT = "rgb(93, 176, 67)"; // #5DB043, couleur de l'année des aperçus
const THEMES = {
  light: { bg: "rgb(243, 241, 235)", card: "rgb(255, 255, 255)" },
  dark: { bg: "rgb(14, 14, 16)", card: "rgb(26, 26, 29)" },
} as const;

test.skip(isProduction, "pages d'aperçu réservées au développement");

const isWeb = () => test.info().project.name === "desktop";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function background(locator: Locator) {
  return locator.evaluate((el) => getComputedStyle(el).backgroundColor);
}

/** La cible fait 44 px de haut : un clic 4 px au-dessus du dessin la touche encore. */
async function expectTallHitArea(page: Page, link: Locator) {
  const box = (await link.boundingBox())!;
  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest("a, button")?.textContent ?? null,
    [box.x + box.width / 2, box.y - 4] as const,
  );
  expect(hit).toBe(await link.textContent());
}

function tabBar(page: Page) {
  return page.getByRole("navigation", { name: "Navigation principale" });
}

test.describe("classement · aperçu", () => {
  test("podium sur mobile, liste dans la colonne de 440 px en web", async ({ page }) => {
    await page.goto("/dev/classement");
    const podium = page.getByRole("list", { name: "Podium" });
    const list = page.getByRole("list", { name: "Classement complet" });

    if (isWeb()) {
      await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Classement 2026");
      await expect(page.getByText("8 participants")).toBeVisible();
      await expect(podium).toBeHidden();
      await expect(list.getByRole("link")).toHaveCount(8);
      for (const row of await list.getByRole("link").all()) await expect(row).toBeVisible();
      const column = (await page.locator("[data-column]").boundingBox())!;
      expect(column.width).toBe(440);
      await expect(tabBar(page)).toBeHidden();
      // Le 1er : rang doré et anneau doré.
      await expect(list.getByRole("link").first()).toContainText("Lea");
    } else {
      await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Classement");
      await expect(podium).toBeVisible();
      await expect(podium.locator("li")).toHaveCount(3);
      // 2ᵉ à gauche, 1er au centre et plus haut, 3ᵉ à droite.
      const steps = podium.locator("[data-podium-step]");
      const [first, second, third] = await Promise.all(
        [1, 2, 3].map((rank) => podium.locator(`li[data-podium-rank="${rank}"] [data-podium-step]`).boundingBox()),
      );
      expect(second!.x).toBeLessThan(first!.x);
      expect(first!.x).toBeLessThan(third!.x);
      expect([first!.height, second!.height, third!.height]).toEqual([128, 96, 76]);
      await expect(steps).toHaveCount(3);
      await expect(podium).toContainText("Remi · toi");
      // Les 3 premiers ne sont pas répétés sous le podium.
      const visibleRows = list.getByRole("link").filter({ visible: true });
      await expect(visibleRows).toHaveCount(5);
      await expect(visibleRows.first()).toContainText("Camille");
      // Barre d'onglets fixée en bas de l'écran.
      const bar = (await tabBar(page).boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(Math.abs(bar.y + bar.height - viewport.height)).toBeLessThanOrEqual(1);
    }
    await expectNoHorizontalScroll(page);
  });

  test("la ligne de l'utilisateur connecté est mise en avant", async ({ page }) => {
    await page.goto("/dev/classement");
    if (isWeb()) {
      const me = page.locator("a[data-me]");
      await expect(me).toBeVisible();
      await expect(me).toContainText("Remi · toi");
      // La couleur d'exemple de la page est posée après le chargement : on l'attend.
      await expect.poll(() => background(me)).toBe(ACCENT);
    } else {
      // Sur le podium : anneau couleur de l'année et « · toi ».
      const slot = page.locator('li[data-podium-rank="2"]');
      await expect(slot).toContainText("Remi · toi");
      const avatar = slot.locator("[data-avatar]");
      await expect.poll(() => avatar.evaluate((el) => getComputedStyle(el).boxShadow)).toContain(ACCENT);
    }
  });

  test("même hors du haut du classement", async ({ page }) => {
    await page.goto("/dev/classement?scenario=dehors");
    const mine = page.getByRole("list", { name: "Ta place" });
    await expect(mine).toBeVisible();
    const row = mine.getByRole("link");
    await expect(row).toContainText("Zoe · toi");
    await expect(row).toContainText("12");
    expect(await background(row)).toBe(ACCENT);
    // Les 8 premiers : en liste en web, 3 sur le podium + 5 en liste sur mobile.
    await expect(page.getByRole("list", { name: "Classement complet" }).getByRole("link")).toHaveCount(isWeb() ? 8 : 5);
    await expectNoHorizontalScroll(page);
  });

  test("changer de critère et de période", async ({ page }) => {
    await page.goto("/dev/classement");
    const criteria = page.getByRole("group", { name: "Critère" });
    await expect(criteria.getByRole("link", { name: "Points" })).toHaveAttribute("aria-current", "true");
    await expectTallHitArea(page, criteria.getByRole("link", { name: "Pays" }));

    await criteria.getByRole("link", { name: "Pays" }).click();
    await expect(page).toHaveURL(/critere=pays/);
    await expect(criteria.getByRole("link", { name: "Pays" })).toHaveAttribute("aria-current", "true");
    // Remi a le plus de pays (11).
    const leader = isWeb()
      ? page.getByRole("list", { name: "Classement complet" }).getByRole("link").first()
      : page.locator('li[data-podium-rank="1"]');
    await expect(leader).toContainText("Remi");
    await expect(leader).toContainText("11");

    const period = page.getByRole("group", { name: "Période" }).filter({ visible: true });
    await period.getByRole("link", { name: "Toujours" }).click();
    await expect(page).toHaveURL(/periode=toujours/);
    await expect(page).toHaveURL(/critere=pays/);
    if (isWeb()) await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Classement depuis toujours");
    await expect(period.getByRole("link", { name: "Toujours" })).toHaveAttribute("aria-current", "true");
  });

  test("ex aequo : même rang", async ({ page }) => {
    await page.goto("/dev/classement?scenario=exaequo");
    if (isWeb()) {
      const rows = page.getByRole("list", { name: "Classement complet" }).getByRole("link");
      await expect(rows.nth(0)).toHaveAccessibleName(/^1er, Lea/);
      await expect(rows.nth(1)).toHaveAccessibleName(/^1er, Remi/);
      await expect(rows.nth(2)).toHaveAccessibleName(/^3ᵉ, Hugo/);
    } else {
      await expect(page.locator('li[data-podium-rank="1"]')).toHaveCount(2);
      await expect(page.locator('li[data-podium-rank="3"]')).toHaveCount(1);
    }
  });

  test("classement vide : invitation à coller le premier sticker", async ({ page }) => {
    await page.goto("/dev/classement?scenario=vide");
    await expect(page.getByRole("link", { name: "Colle le premier !" })).toHaveAttribute("href", "/spots/new");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`thème ${scheme === "light" ? "clair" : "sombre"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/dev/classement");
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(THEMES[scheme].bg);
      const row = page.getByRole("list", { name: "Classement complet" }).getByRole("link").filter({ hasText: "Jade" });
      expect(await background(row)).toBe(THEMES[scheme].card);
      if (isWeb()) expect(await background(page.locator("[data-column]"))).toBe(THEMES[scheme].card);
      await page.screenshot({ path: test.info().outputPath(`classement-${scheme}.png`), fullPage: true });
    });
  }
});

test.describe("profil · aperçu", () => {
  test("en-tête, score, rang et compteurs (maquette Profil)", async ({ page }) => {
    await page.goto("/dev/profil");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Remi");
    await expect(page.getByText("Depuis 2023")).toBeVisible();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    await expect(page.getByRole("link", { name: "Réglages" })).toHaveAttribute("href", "/me/settings");
    await expect(page.getByText("Score total")).toBeVisible();
    await expect(page.getByText("2ᵉ au classement")).toBeVisible();
    const stats = page.getByRole("definition");
    await expect(stats).toHaveText(["27", "11", "3"]);
    await expect(page.getByRole("term")).toHaveText(["stickers", "pays", "premiers du pays"]);
    await expectNoHorizontalScroll(page);
  });

  test("album : tuiles par année, pays à conquérir en pointillés, légende", async ({ page }) => {
    await page.goto("/dev/profil");
    const album = page.locator("section#album");
    await expect(album.getByRole("heading", { name: "Album" })).toBeVisible();
    const conquered = album.locator('[data-album-tile="conquered"]');
    const locked = album.locator('[data-album-tile="locked"]');
    await expect(conquered).toHaveCount(8);
    await expect(locked).toHaveCount(4);
    const names = ["Norvège", "Japon", "Bhoutan", "Corée du Nord"];
    const bases = [10, 25, 60, 150];
    for (const [index, name] of names.entries()) {
      await expect(locked.nth(index).getByRole("img")).toHaveAccessibleName(
        `${name}, à conquérir : ${bases[index]} points de base et plus`,
      );
    }
    expect(await locked.first().locator("[role=img]").evaluate((el) => getComputedStyle(el).borderStyle)).toBe("dashed");
    // Première tuile : la France, conquise en 2023 (jaune).
    expect(await background(conquered.first().getByRole("img"))).toBe("rgb(242, 194, 48)");
    // Grille de 4 colonnes.
    const tops = await album.locator("[data-album-tile]").evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)),
    );
    expect(new Set(tops.slice(0, 4)).size).toBe(1);
    expect(tops[4]).toBeGreaterThan(tops[0]);
    await expect(album.locator("[data-legend-year]")).toHaveCount(4);
    await expect(album.getByRole("list", { name: "Années" })).toContainText("23");
  });

  test("l'onglet Album descend jusqu'à l'album", async ({ page }) => {
    await page.goto("/dev/profil#album");
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

  test("liste des stickers filtrable par année, en attente et masqués signalés", async ({ page }) => {
    await page.goto("/dev/profil");
    const items = page.locator("li[data-spot-year]");
    await expect(items).toHaveCount(10);
    await expect(page.locator('li[data-spot-status="pending_review"]')).toContainText("En attente");
    await expect(page.locator('li[data-spot-status="hidden"]')).toContainText("Masqué");

    const filter = page.getByRole("group", { name: "Filtrer par année" });
    await filter.getByRole("button", { name: "2025" }).click();
    await expect(filter.getByRole("button", { name: "2025" })).toHaveAttribute("aria-pressed", "true");
    await expect(items).toHaveCount(4);
    for (const year of await items.evaluateAll((els) => els.map((el) => el.getAttribute("data-spot-year")))) {
      expect(year).toBe("2025");
    }
    await filter.getByRole("button", { name: "Tous" }).click();
    await expect(items).toHaveCount(10);
  });

  test("profil public : ni réglages, ni rôle, ni stickers en attente", async ({ page }) => {
    await page.goto("/dev/profil?qui=autre");
    await expect(page.getByRole("heading", { name: "Ses stickers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Réglages" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(page.locator('li[data-spot-status="pending_review"], li[data-spot-status="hidden"]')).toHaveCount(0);
    await expect(page.locator("li[data-spot-year]")).toHaveCount(8);
  });

  test("nouveau compte : album vide et pays à conquérir", async ({ page }) => {
    await page.goto("/dev/profil?qui=nouveau");
    await expect(page.getByText("Pas encore classé")).toBeVisible();
    await expect(page.getByText(/Ton album est vide/)).toBeVisible();
    await expect(page.locator('[data-album-tile="locked"]')).toHaveCount(4);
    await expect(page.getByText("Tu n'as encore collé aucun sticker.")).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`thème ${scheme === "light" ? "clair" : "sombre"}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/dev/profil");
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(THEMES[scheme].bg);
      const statCard = page.getByRole("term").first().locator("..");
      expect(await background(statCard)).toBe(THEMES[scheme].card);
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: test.info().outputPath(`profil-${scheme}.png`), fullPage: true });
    });
  }
});
