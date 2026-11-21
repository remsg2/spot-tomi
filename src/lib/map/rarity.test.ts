import { expression, latest, type ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import { relativeLuminance } from "@/lib/design/color";
import { mixHex, NO_STICKER_COLOR, rarityFillExpression, rarityLevel, rarityPaint, rarityPalette } from "./rarity";
import type { CountryRarity } from "./types";

const rows: CountryRarity[] = [
  { iso2: "AR", tier: "lointain", base_points: 100, spot_count: 1 },
  { iso2: "BT", tier: "rare", base_points: 200, spot_count: 2 },
  { iso2: "FR", tier: "courant", base_points: 100, spot_count: 12 },
  { iso2: "KP", tier: "extreme", base_points: 300, spot_count: 64 },
  { iso2: "TM", tier: "rare", base_points: 200, spot_count: 0 },
];

function colorOf(fill: unknown, iso2: string) {
  const compiled = expression.createExpression(fill as ExpressionSpecification, "layers[0].paint.fill-color");
  if (compiled.result !== "success") throw new Error(JSON.stringify(compiled.value));
  return compiled.value.evaluate({ zoom: 2 }, { type: "Polygon", properties: { iso2 } } as never);
}

describe("carte de conquête", () => {
  it("gris pour un pays vierge, puis selon le nombre de stickers (1, 2-9, 10-49, 50+)", () => {
    expect(rows.map(rarityLevel)).toEqual([1, 2, 3, 4, 0]);
  });
});

describe("palette", () => {
  it("de plus en plus foncée quand le pays compte plus de stickers", () => {
    const [, l1, l2, l3, l4] = rarityPalette("#5B8DEF", "light");
    const luminances = [l1, l2, l3, l4].map(relativeLuminance);
    for (let i = 1; i < luminances.length; i += 1) {
      expect(luminances[i]).toBeLessThan(luminances[i - 1]);
    }
    expect(l3).toBe("#5B8DEF");
  });

  it("les pays sans sticker restent gris, en clair comme en sombre", () => {
    expect(rarityPalette("#5B8DEF", "light")[0]).toBe(NO_STICKER_COLOR.light);
    expect(rarityPalette("#5B8DEF", "dark")[0]).toBe(NO_STICKER_COLOR.dark);
  });

  it("mélange de couleurs", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#5B8DEF", "#5B8DEF", 0.3)).toBe("#5B8DEF");
  });
});

describe("expression de remplissage", () => {
  it("colore chaque pays selon son niveau, gris par défaut", () => {
    const palette = rarityPalette("#FF7A59", "dark");
    const fill = rarityFillExpression(rows, palette);
    expect(colorOf(fill, "AR")).toBe(palette[1]);
    expect(colorOf(fill, "FR")).toBe(palette[3]);
    expect(colorOf(fill, "KP")).toBe(palette[4]);
    expect(colorOf(fill, "TM")).toBe(palette[0]);
    expect(colorOf(fill, "ZZ")).toBe(palette[0]);
  });

  it("fond simplifié : la même couche dessine les terres au-delà du zoom 3", () => {
    const palette = rarityPalette("#FF7A59", "light");
    const offline = rarityPaint(rows, palette, "#FBFAF7");
    expect(offline["fill-opacity"]).toBe(1);
    const at = (zoom: number) => {
      const spec = (latest as unknown as { paint_fill: Record<string, never> }).paint_fill["fill-color"];
      const compiled = expression.createExpression(offline["fill-color"], "layers[0].paint.fill-color", spec);
      if (compiled.result !== "success") throw new Error(JSON.stringify(compiled.value));
      return compiled.value.evaluate({ zoom }, { type: "Polygon", properties: { iso2: "ZZ" } } as never);
    };
    expect(String(at(2))).toContain("236"); // gris des pays sans sticker (#ECEAE3)
    expect(String(at(5))).toContain("251"); // terres (#FBFAF7)
    // Sur les tuiles : voile qui s'efface, couleurs inchangées.
    expect(rarityPaint(rows, palette, null)["fill-color"]).toEqual(rarityFillExpression(rows, palette));
  });

  it("sans aucun sticker : une couleur unie", () => {
    expect(rarityFillExpression([], rarityPalette("#FF7A59", "light"))).toBe(NO_STICKER_COLOR.light);
  });
});
