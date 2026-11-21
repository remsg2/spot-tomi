import { ta } from "@/i18n/admin.fr";
import type { ScoringRule } from "./types";

/** Regroupement des règles de scoring_rules pour l'onglet Barème (docs/contrats.md §3). */
const GROUPS = {
  tiers: ["tier_courant", "tier_lointain", "tier_rare", "tier_extreme"],
  bonus: [
    "bonus_first_country",
    "bonus_first_city",
    "isolation_points_per_10km",
    "isolation_cap",
    "bonus_exceptional",
    "altitude_threshold_m",
    "bonus_altitude",
    "home_points_per_1000km",
  ],
  malus: [
    "neighbor_radius_m",
    "neighbor_divisor",
    "home_blur_radius_m",
    "daily_publish_limit",
    "daily_report_limit",
    "reports_before_review",
    "edit_radius_m",
  ],
} as const;

export type RuleGroup = keyof typeof GROUPS | "other";

export function ruleLabel(key: string): string {
  return ta.scoring.rules[key] ?? key;
}

/** Règles groupées et ordonnées ; une règle inconnue (ajoutée plus tard) va dans « Autres ». */
export function groupRules(rules: ScoringRule[]): Array<{ group: RuleGroup; rules: ScoringRule[] }> {
  const byKey = new Map(rules.map((rule) => [rule.key, rule]));
  const known = new Set<string>(Object.values(GROUPS).flat());
  const groups: Array<{ group: RuleGroup; rules: ScoringRule[] }> = [];
  for (const [group, keys] of Object.entries(GROUPS) as Array<[keyof typeof GROUPS, readonly string[]]>) {
    const list = keys.map((key) => byKey.get(key)).filter((rule): rule is ScoringRule => Boolean(rule));
    if (list.length > 0) groups.push({ group, rules: list });
  }
  const others = rules.filter((rule) => !known.has(rule.key)).sort((a, b) => a.key.localeCompare(b.key));
  if (others.length > 0) groups.push({ group: "other", rules: others });
  return groups;
}

/** Recherche d'un pays sans tenir compte des accents ni de la casse (nom, ISO2 ou ISO3). */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function matchesCountry(country: { iso2: string; iso3: string; name_fr: string }, query: string): boolean {
  const q = normalizeSearch(query);
  if (q === "") return true;
  return (
    normalizeSearch(country.name_fr).includes(q) ||
    country.iso2.toLowerCase() === q ||
    country.iso3.toLowerCase() === q
  );
}
