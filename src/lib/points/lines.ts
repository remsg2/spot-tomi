import type { PointLine } from "@/components/ui";
import type { SpotPointLineRow } from "@/lib/types/database";

/**
 * Puce de chaque critère : grise pour la base et le doublon, couleur de l'édition pour le
 * bonus de rareté. Les clés de l'ancien barème (détail figé avant le cahier des charges
 * V1.1) gardent leur puce d'origine.
 */
const TONES: Record<string, NonNullable<PointLine["tone"]>> = {
  base: "base",
  rarity: "year",
  duplicate: "base",
  base_country: "base",
  first_country: "gold",
  exceptional: "gold",
  neighbor_malus: "base",
};

const BASE_KEYS = new Set(["base", "base_country"]);

/** Lignes de `spot_point_lines` → lignes de `PointsBreakdown`, dans l'ordre d'affichage. */
export function toPointLines(rows: readonly SpotPointLineRow[]): PointLine[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      key: row.rule_key,
      label: row.label,
      detail: row.detail ?? undefined,
      points: row.points,
      isBase: BASE_KEYS.has(row.rule_key),
      tone: TONES[row.rule_key] ?? "year",
    }));
}
