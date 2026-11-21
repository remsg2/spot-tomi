/**
 * Marqueurs des stickers rendus par MapLibre (couches GL). Les groupes de
 * stickers sont dans clusters.ts.
 *
 * Chaque apparence distincte est une image générée une seule fois puis réutilisée
 * par tous les marqueurs qui la partagent : sa clé décrit taille, couleur, anneau
 * doré, état « en attente », points affichés dans la bande, sélection et thème.
 * Les expressions MapLibre ci-dessous calculent la même clé que `markerKey`
 * (vérifié par les tests unitaires).
 */
import type { ExpressionSpecification } from "maplibre-gl";
import { markerSize, type MarkerSize } from "@/lib/design/points";
import type { ThemeName } from "./types";

export type MarkerSpec = {
  size: MarkerSize;
  color: string;
  gold: boolean;
  pending: boolean;
  /** Points écrits dans la bande (dès 34 px, jamais pour un sticker en attente). */
  label: string;
  selected: boolean;
  theme: ThemeName;
};

export type MarkerInput = {
  points: number;
  color: string;
  gold: boolean;
  pending: boolean;
  selected?: boolean;
  theme: ThemeName;
};

/** Marge autour du sticker dans l'image : ombre, anneau doré et halo de sélection. */
export const MARKER_PADDING = 14;

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FALLBACK = "#9A9A94";

export function markerLabel(points: number, pending: boolean): string {
  return markerSize(points) >= 34 && !pending ? String(points) : "";
}

export function markerSpec(input: MarkerInput): MarkerSpec {
  return {
    size: markerSize(input.points),
    color: HEX.test(input.color) ? input.color : FALLBACK,
    gold: input.gold,
    pending: input.pending,
    label: markerLabel(input.points, input.pending),
    selected: input.selected ?? false,
    theme: input.theme,
  };
}

export function markerKey(input: MarkerInput): string {
  const s = markerSpec(input);
  return [
    "m",
    s.size,
    s.color,
    s.gold ? 1 : 0,
    s.pending ? 1 : 0,
    s.label,
    s.selected ? 1 : 0,
    s.theme,
  ].join("|");
}

export function parseMarkerKey(key: string): MarkerSpec | null {
  const parts = key.split("|");
  if (parts.length !== 8 || parts[0] !== "m") return null;
  const [, size, color, gold, pending, label, selected, theme] = parts;
  const n = Number(size);
  if (n !== 26 && n !== 34 && n !== 44) return null;
  if (!HEX.test(color) || (theme !== "light" && theme !== "dark")) return null;
  return {
    size: n,
    color,
    gold: gold === "1",
    pending: pending === "1",
    label,
    selected: selected === "1",
    theme,
  };
}

/** Même calcul que markerKey, évalué par MapLibre pour chaque marqueur. */
export function markerIconExpression(theme: ThemeName, selected: boolean): ExpressionSpecification {
  const points: ExpressionSpecification = ["to-number", ["get", "points"], 0];
  const pending: ExpressionSpecification = ["==", ["get", "pending"], true];
  return [
    "concat",
    "m|",
    ["to-string", ["step", points, 26, 20, 34, 80, 44]],
    "|",
    ["coalesce", ["get", "color"], FALLBACK],
    "|",
    ["case", ["==", ["get", "gold"], true], "1", "0"],
    "|",
    ["case", pending, "1", "0"],
    "|",
    ["case", ["all", [">=", points, 20], ["!", pending]], ["to-string", points], ""],
    `|${selected ? 1 : 0}|${theme}`,
  ];
}

/** Rayon d'arrondi du sticker, comme le composant MapMarker. */
export function markerRadius(size: number): number {
  return Math.round(size * 0.16);
}

/** Taille des points écrits dans la bande. */
export function markerFontSize(size: number): number {
  return size >= 44 ? 12 : 9;
}

/** Épaisseur de l'anneau de sélection (plus large autour d'un anneau doré). */
export function selectionRing(gold: boolean): number {
  return gold ? 6 : 4;
}
