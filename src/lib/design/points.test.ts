import { describe, expect, it } from "vitest";
import { formatPointLine, formatPoints, markerSize } from "./points";

describe("markerSize", () => {
  it("suit les seuils 20 et 80 points", () => {
    expect(markerSize(0)).toBe(26);
    expect(markerSize(19)).toBe(26);
    expect(markerSize(20)).toBe(34);
    expect(markerSize(79)).toBe(34);
    expect(markerSize(80)).toBe(44);
    expect(markerSize(195)).toBe(44);
  });
});

describe("formatPoints", () => {
  it("sépare les milliers à la française", () => {
    expect(formatPoints(1435).replace(/\s/g, " ")).toBe("1 435");
    expect(formatPoints(85)).toBe("85");
  });

  it("préfixe les bonus, pas la base", () => {
    expect(formatPointLine(25, true)).toBe("25");
    expect(formatPointLine(50)).toBe("+50");
    expect(formatPointLine(-3)).toBe("−3");
  });
});
