/**
 * Regroupement des stickers par année (couches GL de MapLibre).
 *
 * Un groupe ne mélange jamais les années : il est dessiné comme une rangée de
 * stickers de Tomi, un par année présente dans la zone, chacun de la couleur
 * de son année et avec son nombre de stickers. Les années ne sont connues que
 * par leur couleur (propriété `color` de spots_in_bbox) : chaque couleur occupe
 * un « créneau » de comptage dans les clusterProperties de la source, dans
 * l'ordre des années (la plus ancienne à gauche).
 *
 * La clé d'image décrit le groupe (`c|thème|total|#COULEUR:n|…`) ; l'expression
 * MapLibre calcule la même clé que `clusterKeyFromProperties` (tests unitaires).
 */
import type { ExpressionSpecification } from "maplibre-gl";
import type { Season, SpotCollection, ThemeName } from "./types";

const HEX = /^#[0-9A-Fa-f]{6}$/;
/** Couleur des stickers sans année connue (même gris que les marqueurs). */
export const CLUSTER_FALLBACK = "#9A9A94";

export type ClusterGroup = { color: string; count: number };

export type ClusterSpec = {
  theme: ThemeName;
  /** Stickers de chaque année présente, dans l'ordre des années. */
  groups: ClusterGroup[];
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
  const parts: ExpressionSpecification[] = slots.map((color, i) => {
    const count: ExpressionSpecification = ["to-number", ["get", slotProperty(i)], 0];
    return ["case", [">", count, 0], ["concat", `|${color}:`, ["to-string", count]], ""];
  });
  return ["concat", `c|${theme}|`, ["to-string", ["get", "point_count"]], ...parts];
}

export function clusterKeyFromProperties(
  slots: readonly string[],
  properties: Record<string, unknown>,
  theme: ThemeName,
): string {
  let key = `c|${theme}|${Number(properties.point_count)}`;
  slots.forEach((color, i) => {
    const count = Number(properties[slotProperty(i)] ?? 0);
    if (count > 0) key += `|${color}:${count}`;
  });
  return key;
}

/**
 * Lit une clé d'image de groupe. Les stickers qui ne tombent dans aucun créneau
 * (couleur inconnue au moment du regroupement) forment un groupe gris final.
 */
export function parseClusterKey(key: string): ClusterSpec | null {
  const [tag, theme, total, ...rest] = key.split("|");
  if (tag !== "c" || (theme !== "light" && theme !== "dark")) return null;
  const count = Number(total);
  if (!Number.isInteger(count) || count < 1) return null;
  const groups: ClusterGroup[] = [];
  for (const part of rest) {
    const [color, n] = part.split(":");
    const value = Number(n);
    if (!HEX.test(color) || !Number.isInteger(value) || value < 1) return null;
    groups.push({ color, count: value });
  }
  const other = count - groups.reduce((sum, group) => sum + group.count, 0);
  if (other > 0) groups.push({ color: CLUSTER_FALLBACK, count: other });
  return { theme, groups };
}

/** Nombre écrit sous le sticker d'une année : « 4829 », puis « 12k » dès 10 000. */
export function clusterCountLabel(count: number): string {
  return count < 10_000 ? String(count) : `${Math.floor(count / 1000)}k`;
}

/** Taille du sticker d'une année dans un groupe, selon son nombre de stickers. */
export function clusterTileSize(count: number): 34 | 40 | 46 {
  return count < 10 ? 34 : count < 100 ? 40 : 46;
}

/** Inclinaison du sticker de rang `index` (alternée, comme collés à la main). */
export function clusterTileTilt(index: number): number {
  return [-5, 4, -3, 5, -4][index % 5];
}
