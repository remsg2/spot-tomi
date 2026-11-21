/**
 * Regroupement des stickers sur la carte (couches GL de MapLibre).
 *
 * Chaque groupe est une bulle : les stickers de Tomi des années présentes dans
 * le groupe (un par année, de la couleur de l'année, la plus ancienne à
 * gauche) et le nombre total de stickers, sans détail par année. Les années ne
 * sont connues que par leur couleur (propriété `color` de spots_in_bbox) :
 * chaque couleur occupe un « créneau » de comptage dans les clusterProperties
 * de la source, dans l'ordre des années ; un créneau non nul = année présente.
 *
 * La clé d'image décrit la bulle (`c|thème|total|#COULEUR|…`) ; l'expression
 * MapLibre calcule la même clé que `clusterKeyFromProperties` (tests unitaires).
 */
import type { ExpressionSpecification } from "maplibre-gl";
import type { Season, SpotCollection, ThemeName } from "./types";

const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Couleur des stickers sans année connue (même gris que les marqueurs). */
export const CLUSTER_FALLBACK = "#9A9A94";

export type ClusterSpec = {
  theme: ThemeName;
  /** Nombre total de stickers du groupe. */
  total: number;
  /** Couleurs des années présentes, dans l'ordre des années. */
  colors: string[];
};

/** Propriété de cluster qui compte les stickers du créneau `index`. */
export function slotProperty(index: number): string {
  return `y${index}`;
}

/**
 * Couleurs à compter, dans l'ordre des années, puis les couleurs des données
 * absentes des saisons (dans leur ordre d'apparition). Couleurs invalides ignorées.
 */
export function clusterSlots(seasons: readonly Season[], data: SpotCollection): string[] {
  const slots: string[] = [];
  const add = (color: unknown) => {
    if (typeof color === "string" && HEX.test(color) && !slots.includes(color)) slots.push(color);
  };
  for (const season of [...seasons].sort((a, b) => a.year - b.year)) add(season.color_hex);
  for (const feature of data.features) add(feature.properties.color);
  return slots;
}

export function sameSlots(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((color, i) => color === b[i]);
}

/** Nombre de stickers de chaque créneau, additionné par MapLibre dans chaque groupe. */
export function clusterProperties(slots: readonly string[]): Record<string, ExpressionSpecification> {
  return Object.fromEntries(
    slots.map((color, i) => [slotProperty(i), ["+", ["case", ["==", ["get", "color"], color], 1, 0]]]),
  );
}

/** Même calcul que clusterKeyFromProperties, évalué par MapLibre pour chaque groupe. */
export function clusterIconExpression(slots: readonly string[], theme: ThemeName): ExpressionSpecification {
  const parts: ExpressionSpecification[] = slots.map((color, i) => [
    "case",
    [">", ["to-number", ["get", slotProperty(i)], 0], 0],
    `|${color}`,
    "",
  ]);
  return ["concat", `c|${theme}|`, ["to-string", ["get", "point_count"]], ...parts];
}

export function clusterKeyFromProperties(
  slots: readonly string[],
  properties: Record<string, unknown>,
  theme: ThemeName,
): string {
  let key = `c|${theme}|${Number(properties.point_count)}`;
  slots.forEach((color, i) => {
    if (Number(properties[slotProperty(i)] ?? 0) > 0) key += `|${color}`;
  });
  return key;
}

/**
 * Lit une clé d'image de groupe. Sans aucune année reconnue (couleur inconnue
 * au moment du regroupement), la bulle montre un sticker gris.
 */
export function parseClusterKey(key: string): ClusterSpec | null {
  const [tag, theme, total, ...colors] = key.split("|");
  if (tag !== "c" || (theme !== "light" && theme !== "dark")) return null;
  const count = Number(total);
  if (!Number.isInteger(count) || count < 1) return null;
  if (colors.some((color) => !HEX.test(color))) return null;
  return { theme, total: count, colors: colors.length > 0 ? colors : [CLUSTER_FALLBACK] };
}

const countFormat = new Intl.NumberFormat("fr-FR");

/** Nombre total écrit dans la bulle : « 4 829 », puis « 12k » dès 10 000. */
export function clusterCountLabel(count: number): string {
  return count < 10_000 ? countFormat.format(count) : `${Math.floor(count / 1000)}k`;
}

/** Côté des mini-stickers de la bulle, et leur décalage (ils se chevauchent). */
export const CLUSTER_STICKER_SIZE = 22;
export const CLUSTER_STICKER_STEP = 15;

/** Inclinaison du mini-sticker de rang `index` (alternée, comme collés à la main). */
export function clusterStickerTilt(index: number): number {
  return [-6, 5, -4, 6, -5][index % 5];
}
