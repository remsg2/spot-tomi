import { describe, expect, it } from "vitest";
import { mobileModeFor, NAV_ITEMS, spotIdFromPath } from "./routes";

const ID = "00000000-0000-4000-8000-000000000c04";

describe("gabarit selon la page", () => {
  it("la carte en plein écran sur /", () => {
    expect(mobileModeFor("/")).toBe("map");
  });

  it("la fiche lieu en plein écran, sans barre d'onglets", () => {
    expect(mobileModeFor(`/spots/${ID}`)).toBe("sheet");
    expect(spotIdFromPath(`/spots/${ID.toUpperCase()}`)).toBe(ID);
  });

  it("les autres pages avec la barre d'onglets", () => {
    expect(mobileModeFor("/leaderboard")).toBe("page");
    expect(mobileModeFor("/spots/new")).toBe("page");
    expect(spotIdFromPath("/spots/new")).toBeNull();
  });

  it("l'onglet Carte reste actif sur une fiche", () => {
    const map = NAV_ITEMS.find((item) => item.key === "map")!;
    expect(map.match(`/spots/${ID}`)).toBe(true);
    expect(map.match("/leaderboard")).toBe(false);
  });
});
