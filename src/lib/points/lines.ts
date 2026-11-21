import type { PointLine } from "@/components/ui";
import type { PointRuleKey, SpotPointLineRow } from "@/lib/types/database";

/** Puce de chaque critère : grise pour la base, dorée pour le premier du pays et l'exceptionnel. */
const TONES: Record<PointRuleKey, NonNullable<PointLine["tone"]>> = {
  base_country: "base",
  first_country: "gold",
  first_city: "year",
  isolation: "year",
  exceptional: "gold",
  altitude: "year",
  home_distance: "year",
  neighbor_malus: "base",
};

/** Lignes de `spot_point_lines` → lignes de `PointsBreakdown`, dans l'ordre d'affichage. */
export function toPointLines(rows: readonly SpotPointLineRow[]): PointLine[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      key: row.rule_key,
      label: row.label,
      detail: row.detail ?? undefined,
      points: row.points,
      isBase: row.rule_key === "base_country",
      tone: TONES[row.rule_key] ?? "year",
    }));
}
