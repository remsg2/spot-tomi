import type { PointLine } from "@/components/ui";
import type { RarityCategory } from "@/lib/types/database";

/** Règles du barème (table scoring_rules), avec les valeurs par défaut du cahier des charges V1.1. */
export const DEFAULT_RULES = {
  base_points: 100,
  bonus_touristique: 20,
  bonus_remarquable: 50,
  bonus_isole: 100,
  bonus_tres_rare: 200,
  isole_city_km: 50,
  tres_rare_city_km: 300,
  isole_altitude_m: 3000,
  tres_rare_altitude_m: 4000,
  neighbor_radius_m: 200,
  daily_publish_limit: 20,
  daily_report_limit: 10,
  reports_before_review: 3,
  edit_radius_m: 200,
  edit_window_days: 7,
  comment_max_length: 280,
} as const;

export type RuleKey = keyof typeof DEFAULT_RULES;
export type Rules = Record<RuleKey, number>;

/** Fusionne les lignes de scoring_rules avec les valeurs par défaut (clé inconnue ignorée). */
export function toRules(rows: ReadonlyArray<{ key: string; value: number | string }> | null): Rules {
  const rules: Rules = { ...DEFAULT_RULES };
  for (const row of rows ?? []) {
    const value = Number(row.value);
    if (row.key in rules && Number.isFinite(value)) rules[row.key as RuleKey] = value;
  }
  return rules;
}

/** Bonus d'une catégorie de rareté (le lieu courant n'en a pas). */
export function categoryBonus(category: RarityCategory, rules: Rules): number {
  switch (category) {
    case "courant":
      return 0;
    case "touristique":
      return rules.bonus_touristique;
    case "remarquable":
      return rules.bonus_remarquable;
    case "isole":
      return rules.bonus_isole;
    case "tres_rare":
      return rules.bonus_tres_rare;
  }
}

/** Points d'un sticker : base + bonus, sans bonus pour un doublon (autre sticker à moins de 200 m). */
export function spotPoints(category: RarityCategory, duplicate: boolean, rules: Rules): number {
  return rules.base_points + (duplicate ? 0 : categoryBonus(category, rules));
}

/**
 * Exemple : un sticker dans les hautes terres d'Islande, à 100 km de la ville la plus
 * proche, avec le barème en vigueur.
 */
export function isolatedExample(rules: Rules): { lines: PointLine[]; total: number } {
  const lines: PointLine[] = [
    { key: "base", label: "Sticker publié", detail: "Points de base", points: rules.base_points, isBase: true, tone: "base" },
    { key: "rarity", label: "Lieu isolé", detail: "100 km de la ville la plus proche (Akureyri)", points: rules.bonus_isole },
  ];
  return { lines, total: lines.reduce((sum, line) => sum + line.points, 0) };
}
