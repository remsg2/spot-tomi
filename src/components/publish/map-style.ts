import type { StyleSpecification } from "maplibre-gl";

/**
 * Fonds de carte gratuits OpenFreeMap (sans clé), clair et sombre.
 * La carte principale (étape 6) a les siens ; ce sélecteur reste autonome.
 */
export const MAP_STYLE_URLS = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

/** Fond uni si les tuiles sont inaccessibles : la carte reste utilisable (cercle, repère). */
export function fallbackStyle(theme: "light" | "dark"): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "fond",
        type: "background",
        paint: { "background-color": theme === "dark" ? "#222226" : "#fbfaf7" },
      },
    ],
  };
}

/** Télécharge le style (délai court) ; null en cas d'échec. */
export async function loadMapStyle(theme: "light" | "dark", timeoutMs = 4000): Promise<StyleSpecification | null> {
  try {
    const response = await fetch(MAP_STYLE_URLS[theme], { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return (await response.json()) as StyleSpecification;
  } catch {
    return null;
  }
}
