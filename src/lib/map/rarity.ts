/**
 * Coloration des pays au dézoom (zoom ≤ 3) selon leur rareté : plus foncé quand le
 * pays rapporte plus, gris quand personne n'y a encore collé de sticker.
 */
import type { ExpressionSpecification } from "maplibre-gl";
import type { CountryRarity, ThemeName } from "./types";

/** 0 : aucun sticker ; 1 courant ; 2 lointain ; 3 rare ; 4 extrême (d'après les points de base). */
export type RarityLevel = 0 | 1 | 2 | 3 | 4;

export function rarityLevel(row: Pick<CountryRarity, "base_points" | "spot_count">): RarityLevel {
  if (row.spot_count <= 0) return 0;
  if (row.base_points <= 10) return 1;
  if (row.base_points <= 25) return 2;
  if (row.base_points <= 60) return 3;
  return 4;
}

const HEX = /^#([0-9A-Fa-f]{6})$/;

function toRgb(hex: string): [number, number, number] {
  const match = HEX.exec(hex);
  if (!match) throw new Error(`Couleur invalide : ${hex}`);
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Mélange deux couleurs : t = 0 → a, t = 1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = toRgb(a);
  const cb = toRgb(b);
  const mixed = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Gris des pays sans sticker. */
export const NO_STICKER_COLOR: Record<ThemeName, string> = { light: "#ECEAE3", dark: "#2E2E33" };

const INK = "#111111";
const LIGHT_BASE = "#FFFFFF";
const DARK_BASE = "#222226";

/**
 * Teintes de la couleur de l'année, de la plus claire (pays courant) à la plus
 * foncée (pays extrême). Index 0 : pays sans sticker.
 */
export function rarityPalette(yearColor: string, theme: ThemeName): [string, string, string, string, string] {
  const color = HEX.test(yearColor) ? yearColor : "#9A9A94";
  const base = theme === "dark" ? DARK_BASE : LIGHT_BASE;
  return [
    NO_STICKER_COLOR[theme],
    mixHex(color, base, theme === "dark" ? 0.6 : 0.65),
    mixHex(color, base, theme === "dark" ? 0.3 : 0.35),
    color,
    mixHex(color, INK, 0.4),
  ];
}

/** Expression `fill-color` de la couche des pays, à partir de country_rarity. */
export function rarityFillExpression(
  rows: CountryRarity[],
  palette: readonly string[],
): ExpressionSpecification | string {
  const byLevel = new Map<RarityLevel, string[]>();
  for (const row of rows) {
    const level = rarityLevel(row);
    if (level === 0) continue;
    const codes = byLevel.get(level) ?? [];
    codes.push(row.iso2.trim().toUpperCase());
    byLevel.set(level, codes);
  }
  if (byLevel.size === 0) return palette[0];
  const branches: (string | string[])[] = [];
  for (const level of [1, 2, 3, 4] as const) {
    const codes = byLevel.get(level);
    if (codes && codes.length > 0) branches.push([...new Set(codes)].sort(), palette[level]);
  }
  return ["match", ["get", "iso2"], ...branches, palette[0]] as unknown as ExpressionSpecification;
}

/** Les pays se colorent jusqu'au zoom 3, puis s'effacent avant 4. */
export const RARITY_MAX_ZOOM = 4;
export const RARITY_OPACITY: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], 3, 0.85, 4, 0];

/**
 * Peinture de la couche des pays. Sur les tuiles OpenFreeMap : un voile coloré qui
 * s'efface entre les zooms 3 et 4. Sur le fond simplifié (`landColor`), la même
 * couche dessine aussi les terres : une seule passe de remplissage au lieu de deux.
 */
export function rarityPaint(
  rows: CountryRarity[],
  palette: readonly string[],
  landColor: string | null,
): { "fill-color": ExpressionSpecification | string; "fill-opacity": ExpressionSpecification | number } {
  const fill = rarityFillExpression(rows, palette);
  if (!landColor) return { "fill-color": fill, "fill-opacity": RARITY_OPACITY };
  return {
    "fill-color": ["interpolate", ["linear"], ["zoom"], 3, fill, RARITY_MAX_ZOOM, landColor] as ExpressionSpecification,
    "fill-opacity": 1,
  };
}
