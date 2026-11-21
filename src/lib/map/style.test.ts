import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { fallbackStyle, firstSymbolLayerId, MAP_COLORS, patchBaseStyle } from "./style";

const openFreeMapLike: StyleSpecification = {
  version: 8,
  sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f2f3f0" } },
    { id: "water", type: "fill", source: "openmaptiles", "source-layer": "water", paint: { "fill-color": "#c2c8ca" } },
    { id: "park", type: "fill", source: "openmaptiles", "source-layer": "park", paint: { "fill-color": "#e6e9e5" } },
    {
      id: "place_country",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      layout: { "text-field": "{name}", "text-font": ["Noto Sans Regular"] },
    },
  ],
};

describe("fond de carte", () => {
  it("recolore le fond et l'eau avec les jetons de l'app, sans toucher au reste", () => {
    const patched = patchBaseStyle(openFreeMapLike, "dark");
    expect(patched.layers[0]).toMatchObject({ paint: { "background-color": MAP_COLORS.dark.land } });
    expect(patched.layers[1]).toMatchObject({ paint: { "fill-color": MAP_COLORS.dark.water } });
    expect(patched.layers[2]).toEqual(openFreeMapLike.layers[2]);
    expect(validateStyleMin(patched)).toEqual([]);
  });

  it("le fond de secours est un style valide, sans tuiles ni glyphes", () => {
    const style = fallbackStyle("light", "https://exemple.test/geo/countries-110m.json");
    expect(validateStyleMin(style)).toEqual([]);
    expect(style.glyphs).toBeUndefined();
    expect(style.layers[0]).toMatchObject({ paint: { "background-color": MAP_COLORS.light.water } });
  });

  it("trouve la première couche de texte", () => {
    expect(firstSymbolLayerId(openFreeMapLike)).toBe("place_country");
    expect(firstSymbolLayerId(fallbackStyle("dark", "/x.json"))).toBeUndefined();
  });
});
