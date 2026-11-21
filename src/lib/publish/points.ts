import type { PointLine } from "@/components/ui";
import type { PublishedPointLine } from "./contract";

/**
 * Clés de règle (spot_point_lines.rule_key, étape 4) affichées comme les
 * points de base du pays (sans « + ») ou avec la puce dorée.
 */
const BASE_KEYS = new Set(["base", "country_base", "base_country", "tier", "country_tier"]);
const GOLD_KEYS = new Set(["first_country", "bonus_first_country", "exceptional", "bonus_exceptional"]);

export function isBaseRule(ruleKey: string): boolean {
  return BASE_KEYS.has(ruleKey) || ruleKey.startsWith("tier_");
}

/** Lignes du contrat publish-spot → lignes du design system (PointsBreakdown). */
export function toPointLines(lines: PublishedPointLine[]): PointLine[] {
  return lines.map((line) => {
    const isBase = isBaseRule(line.ruleKey);
    return {
      key: line.ruleKey,
      label: line.label,
      detail: line.detail ?? undefined,
      points: line.points,
      isBase,
      tone: isBase ? "base" : GOLD_KEYS.has(line.ruleKey) ? "gold" : "year",
    };
  });
}
