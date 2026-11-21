import type { PointLine } from "@/components/ui";

/** Règles du barème (table scoring_rules), avec les valeurs par défaut de la spec. */
export const DEFAULT_RULES = {
  tier_courant: 10,
  tier_lointain: 25,
  tier_rare: 60,
  tier_extreme: 150,
  bonus_first_country: 50,
  bonus_first_city: 15,
  isolation_points_per_10km: 1,
  isolation_cap: 40,
  bonus_exceptional: 20,
  altitude_threshold_m: 3000,
  bonus_altitude: 15,
  home_points_per_1000km: 5,
  neighbor_radius_m: 200,
  neighbor_divisor: 4,
  home_blur_radius_m: 500,
  daily_publish_limit: 20,
  daily_report_limit: 10,
  reports_before_review: 3,
  edit_radius_m: 200,
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

/** Points d'isolement pour une distance en km au sticker le plus proche. */
export function isolationPoints(km: number, rules: Rules): number {
  return Math.min(rules.isolation_cap, Math.floor(km / 10) * rules.isolation_points_per_10km);
}

/** Points « loin de chez toi » pour une distance en km au domicile. */
export function homePoints(km: number, rules: Rules): number {
  return Math.floor(km / 1000) * rules.home_points_per_1000km;
}

/**
 * Exemple de la spécification (Ushuaïa, Argentine) recalculé avec le barème
 * en vigueur : pays lointain, premier du pays et de la ville, 1 240 km du
 * sticker le plus proche, 13 000 km du domicile.
 */
export function ushuaiaExample(rules: Rules): { lines: PointLine[]; total: number } {
  const lines: PointLine[] = [
    { key: "base", label: "Pays lointain", detail: "Argentine, points de base", points: rules.tier_lointain, isBase: true, tone: "base" },
    { key: "first_country", label: "Premier sticker du pays", detail: "Personne avant toi en Argentine", points: rules.bonus_first_country, tone: "gold" },
    { key: "first_city", label: "Première ville", detail: "Ushuaïa", points: rules.bonus_first_city },
    { key: "isolation", label: "Isolement", detail: "1 240 km du sticker le plus proche", points: isolationPoints(1240, rules) },
    { key: "home", label: "Loin de chez toi", detail: "13 000 km du domicile", points: homePoints(13000, rules) },
  ];
  return { lines, total: lines.reduce((sum, line) => sum + line.points, 0) };
}
