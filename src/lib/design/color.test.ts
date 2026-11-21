import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  FALLBACK_YEAR_COLOR,
  isHexColor,
  isReadableYearColor,
} from "./color";

describe("contraste", () => {
  it("noir sur blanc vaut 21, une couleur sur elle-même vaut 1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#5DB043", "#5DB043")).toBeCloseTo(1, 5);
  });

  it("est symétrique", () => {
    expect(contrastRatio("#111111", "#5B8DEF")).toBeCloseTo(
      contrastRatio("#5B8DEF", "#111111"),
      10,
    );
  });

  it("accepte les couleurs d'exemple des maquettes sous du texte noir", () => {
    for (const color of ["#5DB043", "#5B8DEF", "#FF7A59", "#F2C230", FALLBACK_YEAR_COLOR]) {
      expect(isReadableYearColor(color), color).toBe(true);
    }
  });

  it("refuse une couleur trop sombre ou invalide", () => {
    expect(isReadableYearColor("#333333")).toBe(false);
    expect(isReadableYearColor("#1D4ED8")).toBe(false);
    expect(isReadableYearColor("vert")).toBe(false);
    expect(isHexColor("#12345")).toBe(false);
  });
});
