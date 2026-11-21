import { describe, expect, it } from "vitest";
import { ta } from "@/i18n/admin.fr";
import { SEASON_SWATCHES } from "@/lib/admin/swatches";
import {
  checkYearColor,
  normalizeHex,
  parseCountryTierForm,
  parseExceptionalForm,
  parseAdjustForm,
  parseBadgeForm,
  parseDeleteUserForm,
  parseEditionForm,
  parseModerationForm,
  parseRarityForm,
  parseReasonForm,
  parseRoleForm,
  parseRuleForm,
  parseRuleValue,
  parseSeasonForm,
  parseSpotReference,
  parseSuspendForm,
  yearColorError,
} from "./admin";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const SPOT = "8f14e45f-ceea-467a-9575-3b4a8b2f1c11";

describe("couleur de l'année", () => {
  it("normalise les saisies hexadécimales", () => {
    expect(normalizeHex("#5db043")).toBe("#5DB043");
    expect(normalizeHex("5DB043")).toBe("#5DB043");
    expect(normalizeHex("  #abc ")).toBe("#AABBCC");
    expect(normalizeHex("#5DB04")).toBeNull();
    expect(normalizeHex("vert")).toBeNull();
    expect(normalizeHex("#GGGGGG")).toBeNull();
  });

  it("calcule le même contraste que la base (private.contrast_ratio)", () => {
    // Valeurs relevées en SQL sur la migration 20261126000000_admin.
    const sql: Record<string, number> = {
      "#5DB043": 6.9747,
      "#5B8DEF": 5.8458,
      "#F2C230": 11.2712,
      "#9A9A94": 6.6755,
      "#1D4ED8": 2.8177,
      "#333333": 1.4945,
    };
    for (const [color, ratio] of Object.entries(sql)) {
      const check = checkYearColor(color);
      expect(check.ratio, color).toBeCloseTo(ratio, 4);
    }
  });

  it("accepte toutes les pastilles de la maquette", () => {
    for (const swatch of SEASON_SWATCHES) {
      expect(checkYearColor(swatch).kind, swatch).toBe("readable");
    }
  });

  it("refuse une couleur sombre avec un message qui donne le contraste", () => {
    const check = checkYearColor("#1d4ed8");
    expect(check.kind).toBe("too-dark");
    expect(yearColorError(check)).toContain("2,82:1");
    expect(yearColorError(checkYearColor("bleu"))).toBe(ta.season.invalidHex);
    expect(yearColorError(checkYearColor("#5DB043"))).toBeNull();
  });

  it("valide le formulaire Appliquer", () => {
    expect(parseSeasonForm(form({ year: "2027", colorHex: "5db043", makeCurrent: "on" }))).toEqual({
      ok: true,
      data: { year: 2027, colorHex: "#5DB043", makeCurrent: true },
    });
    expect(parseSeasonForm(form({ year: "2027", colorHex: "#5DB043" }))).toEqual({
      ok: true,
      data: { year: 2027, colorHex: "#5DB043", makeCurrent: false },
    });
    expect(parseSeasonForm(form({ year: "2027", colorHex: "#333333", makeCurrent: "on" })).ok).toBe(false);
    expect(parseSeasonForm(form({ year: "1999", colorHex: "#5DB043" })).ok).toBe(false);
    expect(parseSeasonForm(form({ year: "2027.5", colorHex: "#5DB043" })).ok).toBe(false);
    expect(parseSeasonForm(form({ colorHex: "#5DB043" })).ok).toBe(false);
  });
});

describe("barème", () => {
  it("lit les nombres à la française", () => {
    expect(parseRuleValue("bonus_first_city", "15")).toEqual({ ok: true, data: 15 });
    expect(parseRuleValue("isolation_points_per_10km", "0,5")).toEqual({ ok: true, data: 0.5 });
    expect(parseRuleValue("altitude_threshold_m", "3 000")).toEqual({ ok: true, data: 3000 });
  });

  it("refuse les valeurs vides, négatives ou démesurées", () => {
    for (const raw of ["", "-1", "abc", "1e9", "Infinity"]) {
      expect(parseRuleValue("bonus_first_city", raw).ok, raw).toBe(false);
    }
    expect(parseRuleValue("comment_max_length", "5")).toEqual({ ok: false, error: ta.scoring.commentInvalid });
    expect(parseRuleValue("comment_max_length", "280").ok).toBe(true);
  });

  it("refuse une clé de règle mal formée", () => {
    expect(parseRuleForm(form({ key: "bonus_first_city", value: "16" }))).toEqual({
      ok: true,
      data: { key: "bonus_first_city", value: 16 },
    });
    expect(parseRuleForm(form({ key: "DROP TABLE", value: "1" })).ok).toBe(false);
  });

  it("met le code pays en majuscules et vérifie le niveau", () => {
    expect(parseCountryTierForm(form({ iso2: "bt", tier: "rare" }))).toEqual({
      ok: true,
      data: { iso2: "BT", tier: "rare" },
    });
    expect(parseCountryTierForm(form({ iso2: "FRA", tier: "rare" })).ok).toBe(false);
    expect(parseCountryTierForm(form({ iso2: "FR", tier: "legendaire" })).ok).toBe(false);
  });

  it("retrouve un sticker par son lien ou son identifiant", () => {
    expect(parseSpotReference(`https://spot-tomi.vercel.app/spots/${SPOT.toUpperCase()}?partage=1`)).toBe(SPOT);
    expect(parseSpotReference(` ${SPOT} `)).toBe(SPOT);
    expect(parseSpotReference("https://spot-tomi.vercel.app/spots/123")).toBeNull();
  });
});

describe("modération et rôles", () => {
  it("n'accepte que les actions de modération connues", () => {
    expect(parseModerationForm(form({ spotId: SPOT, intent: "hide" }))).toEqual({
      ok: true,
      data: { spotId: SPOT, intent: "hide", reason: null },
    });
    expect(parseModerationForm(form({ spotId: SPOT, intent: "delete", reason: "  Photo d'un autre membre " }))).toEqual({
      ok: true,
      data: { spotId: SPOT, intent: "delete", reason: "Photo d'un autre membre" },
    });
    expect(parseModerationForm(form({ spotId: SPOT, intent: "publish_all" })).ok).toBe(false);
    expect(parseModerationForm(form({ spotId: "pas-un-id", intent: "hide" })).ok).toBe(false);
  });

  it("lit la case « lieu exceptionnel »", () => {
    expect(parseExceptionalForm(form({ spotId: SPOT, exceptional: "on" }))).toEqual({
      ok: true,
      data: { spotId: SPOT, exceptional: true },
    });
    expect(parseExceptionalForm(form({ spotId: SPOT }))).toEqual({
      ok: true,
      data: { spotId: SPOT, exceptional: false },
    });
  });

  it("vérifie le rôle et la suspension", () => {
    expect(parseRoleForm(form({ userId: SPOT, role: "moderator" })).ok).toBe(true);
    expect(parseRoleForm(form({ userId: SPOT, role: "superadmin" })).ok).toBe(false);
    expect(parseSuspendForm(form({ userId: SPOT, suspended: "true" }))).toEqual({
      ok: true,
      data: { userId: SPOT, suspended: true },
    });
    expect(parseSuspendForm(form({ userId: SPOT, suspended: "oui" })).ok).toBe(false);
  });
});

describe("cahier des charges V1.1", () => {
  it("catégorie de rareté : motif obligatoire, « auto » rend la main au calcul", () => {
    expect(parseRarityForm(form({ spotId: SPOT, category: "remarquable", reason: "Vue sur le Mont-Blanc" }))).toEqual({
      ok: true,
      data: { spotId: SPOT, category: "remarquable", reason: "Vue sur le Mont-Blanc" },
    });
    expect(parseRarityForm(form({ spotId: SPOT, category: "auto", reason: "Retour au calcul" }))).toMatchObject({
      ok: true,
      data: { category: null },
    });
    expect(parseRarityForm(form({ spotId: SPOT, category: "remarquable", reason: " a " })).ok).toBe(false);
    expect(parseRarityForm(form({ spotId: SPOT, category: "legendaire", reason: "Motif valable" })).ok).toBe(false);
  });

  it("motif de 3 à 200 caractères", () => {
    expect(parseReasonForm(form({ reason: "  Barème corrigé  " }))).toEqual({ ok: true, data: "Barème corrigé" });
    expect(parseReasonForm(form({})).ok).toBe(false);
    expect(parseReasonForm(form({ reason: "x".repeat(201) })).ok).toBe(false);
  });

  it("correction de points : entier non nul, borné, avec motif", () => {
    expect(parseAdjustForm(form({ userId: SPOT, points: "-150", reason: "Doublon de photo" }))).toEqual({
      ok: true,
      data: { userId: SPOT, points: -150, reason: "Doublon de photo" },
    });
    expect(parseAdjustForm(form({ userId: SPOT, points: "0", reason: "Doublon de photo" })).ok).toBe(false);
    expect(parseAdjustForm(form({ userId: SPOT, points: "12.5", reason: "Doublon de photo" })).ok).toBe(false);
    expect(parseAdjustForm(form({ userId: SPOT, points: "100001", reason: "Doublon de photo" })).ok).toBe(false);
    expect(parseAdjustForm(form({ userId: SPOT, points: "50" })).ok).toBe(false);
  });

  it("suppression d'un compte par un admin : identifiant et motif", () => {
    expect(parseDeleteUserForm(form({ userId: SPOT, reason: "Spam répété" }))).toEqual({
      ok: true,
      data: { userId: SPOT, reason: "Spam répété" },
    });
    expect(parseDeleteUserForm(form({ userId: "abc", reason: "Spam répété" })).ok).toBe(false);
  });

  it("édition : couleur lisible, visuel rangé sous son année", () => {
    const base = { year: "2026", name: "Édition 2026", colorHex: "c57cb3", status: "active" };
    expect(parseEditionForm(form(base))).toEqual({
      ok: true,
      data: { year: 2026, name: "Édition 2026", colorHex: "#C57CB3", status: "active", makeCurrent: false, visualPath: null },
    });
    const visual = "2026/0f8fad5b-d9cb-469f-a165-70867728950e.webp";
    expect(parseEditionForm(form({ ...base, makeCurrent: "on", visualPath: visual }))).toMatchObject({
      ok: true,
      data: { makeCurrent: true, visualPath: visual },
    });
    expect(parseEditionForm(form({ ...base, visualPath: "" }))).toMatchObject({ ok: true, data: { visualPath: "" } });
    expect(parseEditionForm(form({ ...base, visualPath: "2025/0f8fad5b-d9cb-469f-a165-70867728950e.webp" })).ok).toBe(false);
    expect(parseEditionForm(form({ ...base, visualPath: "../secret.webp" })).ok).toBe(false);
    expect(parseEditionForm(form({ ...base, colorHex: "#FFFF00" })).ok).toBe(true);
    expect(parseEditionForm(form({ ...base, colorHex: "#222222" })).ok).toBe(false);
    expect(parseEditionForm(form({ ...base, status: "draft" })).ok).toBe(false);
  });

  it("badge : code technique, nom et description", () => {
    expect(parseBadgeForm(form({ code: "first_spot", active: "on", name: " Premier ", description: "Ton premier sticker" }))).toEqual({
      ok: true,
      data: { code: "first_spot", active: true, name: "Premier", description: "Ton premier sticker" },
    });
    expect(parseBadgeForm(form({ code: "Premier Badge", name: "Premier", description: "Ton premier sticker" })).ok).toBe(false);
    expect(parseBadgeForm(form({ code: "first_spot", name: "", description: "Ton premier sticker" })).ok).toBe(false);
  });
});
