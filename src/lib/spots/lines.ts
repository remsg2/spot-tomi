/** Lignes de spot_point_lines → lignes du composant PointsBreakdown. */
import type { PointLine } from "@/components/ui";

export type SpotPointLineRow = {
  rule_key: string;
  position: number;
  label: string;
  detail: string | null;
  points: number;
};

/** Points de base du pays : affichés sans « + », puce grise. */
export function isBaseRule(ruleKey: string): boolean {
  return /^(base|tier)/.test(ruleKey) || ruleKey.includes("base");
}

/** Premier du pays et lieu exceptionnel : puce dorée, comme l'anneau des marqueurs. */
export function isGoldRule(ruleKey: string): boolean {
  return ruleKey.includes("first_country") || ruleKey.includes("exceptional");
}

export function toPointLines(rows: SpotPointLineRow[]): PointLine[] {
  return [...rows]
    .sort((a, b) => a.position - b.position || a.rule_key.localeCompare(b.rule_key))
    .map((row) => {
      const base = isBaseRule(row.rule_key);
      return {
        key: row.rule_key,
        label: row.label,
        detail: row.detail ?? undefined,
        points: row.points,
        isBase: base,
        tone: base ? "base" : isGoldRule(row.rule_key) ? "gold" : "year",
      };
    });
}
