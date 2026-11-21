/**
 * Fonds de carte : tuiles vectorielles gratuites OpenFreeMap (clair « positron »,
 * sombre « dark »), recolorées avec les jetons du design system (--map-water,
 * --map-land). Sans réseau vers les tuiles, un fond minimal tiré des frontières
 * locales (public/geo) prend le relais : la carte reste utilisable hors ligne.
 */
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import type { ThemeName } from "./types";

export const BASE_STYLE_URLS: Record<ThemeName, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

/** Hôte des tuiles, des glyphes et des sprites (mis en cache par le service worker). */
export const TILES_ORIGIN = "https://tiles.openfreemap.org";

/** Fichier des frontières des pays (scripts/build-countries.mjs). */
export const COUNTRIES_URL = "/geo/countries-110m.json";

/** Couleurs de la carte, reprises de globals.css et des maquettes Carte et Web. */
export const MAP_COLORS: Record<
  ThemeName,
  { water: string; land: string; coast: string; edge: string; ring: string; card: string }
> = {
  light: { water: "#DEDCD3", land: "#FBFAF7", coast: "#CFCBC0", edge: "#FFFFFF", ring: "#111111", card: "#FFFFFF" },
  dark: { water: "#0B0C0E", land: "#222226", coast: "#34343A", edge: "#1A1A1D", ring: "#FFFFFF", card: "#1A1A1D" },
};

function isWaterFill(layer: LayerSpecification): boolean {
  return (
    layer.type === "fill" &&
    "source-layer" in layer &&
    (layer["source-layer"] === "water" || layer["source-layer"] === "ocean")
  );
}

/** Recolore le fond et l'eau d'un style OpenFreeMap avec les jetons de l'app. */
export function patchBaseStyle(style: StyleSpecification, theme: ThemeName): StyleSpecification {
  const colors = MAP_COLORS[theme];
  return {
    ...style,
    layers: style.layers.map((layer): LayerSpecification => {
      if (layer.type === "background") {
        return { ...layer, paint: { ...layer.paint, "background-color": colors.land } };
      }
      if (isWaterFill(layer) && layer.type === "fill") {
        return { ...layer, paint: { ...layer.paint, "fill-color": colors.water } };
      }
      return layer;
    }),
  };
}

/** Contour des pays du fond simplifié : la couche de rareté se glisse dessous. */
export const FALLBACK_OUTLINE_LAYER = "land-outline";

/**
 * Simplification des frontières (geojson-vt) : à l'échelle des zooms 0 à 3, les
 * détails fins ne se voient pas et coûtent cher à dessiner.
 */
export const COUNTRIES_TOLERANCE = 1.5;

/**
 * Fond minimal sans tuiles : l'océan et le contour des pays (frontières locales).
 * Les terres sont dessinées par la couche de rareté de la carte (rarityPaint).
 */
export function fallbackStyle(theme: ThemeName, countriesUrl: string): StyleSpecification {
  const colors = MAP_COLORS[theme];
  return {
    version: 8,
    name: "Spot Tomi · fond simplifié",
    sources: {
      countries: { type: "geojson", data: countriesUrl, tolerance: COUNTRIES_TOLERANCE },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": colors.water } },
      {
        id: FALLBACK_OUTLINE_LAYER,
        type: "line",
        source: "countries",
        paint: { "line-color": colors.coast, "line-width": 0.8 },
      },
    ],
  };
}

/** Première couche de texte du fond : la coloration des pays se glisse dessous. */
export function firstSymbolLayerId(style: Pick<StyleSpecification, "layers">): string | undefined {
  return style.layers.find((layer) => layer.type === "symbol")?.id;
}
