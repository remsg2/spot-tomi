import { describe, expect, it } from "vitest";
import { ta } from "@/i18n/admin.fr";
import { SEASON_SWATCHES } from "@/lib/admin/swatches";
import {
  checkYearColor,
  normalizeHex,
  parseCountryTierForm,
  parseExceptionalForm,
  parseModerationForm,
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
      data: { spotId: SPOT, intent: "hide" },
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
