import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { BackLink, PointsBlock, PointsBreakdown } from "@/components/ui";
import { t } from "@/i18n/fr";
import { rulesFr as r } from "@/i18n/rules.fr";
import { formatPoints } from "@/lib/design/points";
import { getPublicEnvResult } from "@/lib/env/server";
import { categoryBonus, DEFAULT_RULES, isolatedExample, toRules, type Rules } from "@/lib/points/rules";
import type { RarityCategory } from "@/lib/types/database";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: r.title, description: r.metaDescription };

type Tier = "courant" | "lointain" | "rare" | "extreme";
const TIERS: Tier[] = ["courant", "lointain", "rare", "extreme"];
const EXAMPLES_PER_TIER = 5;

const CATEGORIES: RarityCategory[] = ["courant", "touristique", "remarquable", "isole", "tres_rare"];

/**
 * Barème lisible par tous (cahier des charges V1.1, section 7), avec les valeurs en
 * vigueur (table scoring_rules, réglable dans l'admin) et des pays d'exemple par niveau.
 */
export default function PointsRulesPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-bg px-4 pt-5 pb-10 md:bg-card md:px-6 md:pt-0">
      <header className="flex flex-col gap-2">
        <BackLink href="/leaderboard" label={t.nav.back} className="mb-1" />
        <h1 className="font-display text-[28px] leading-tight font-normal">{r.title}</h1>
        <p className="text-[15px] text-muted">{r.intro}</p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[22px] bg-soft" aria-hidden="true" />}>
        <RulesContent />
      </Suspense>
    </div>
  );
}

async function loadRules(): Promise<{ rules: Rules; countries: Map<Tier, string[]>; ok: boolean }> {
  const countries = new Map<Tier, string[]>(TIERS.map((tier) => [tier, []]));
  if (!(await getPublicEnvResult()).ok) return { rules: { ...DEFAULT_RULES }, countries, ok: false };
  try {
    const supabase = await getSupabaseServerClient();
    const [rulesResult, countriesResult] = await Promise.all([
      supabase.from("scoring_rules").select("key, value"),
      supabase.from("countries").select("name_fr, tier").order("name_fr"),
    ]);
    for (const row of countriesResult.data ?? []) {
      countries.get(row.tier as Tier)?.push(row.name_fr as string);
    }
    return { rules: toRules(rulesResult.data), countries, ok: !rulesResult.error };
  } catch {
    return { rules: { ...DEFAULT_RULES }, countries, ok: false };
  }
}

async function RulesContent() {
  const { rules, countries, ok } = await loadRules();
  const example = isolatedExample(rules);
  const categoryRule = (category: RarityCategory): string => {
    const text = r.categories[category];
    if (category === "isole") return r.categories.isole.rule(rules.isole_city_km, formatPoints(rules.isole_altitude_m));
    if (category === "tres_rare") {
      return r.categories.tres_rare.rule(rules.tres_rare_city_km, formatPoints(rules.tres_rare_altitude_m));
    }
    return (text as { rule: string }).rule;
  };

  return (
    <>
      {!ok && (
        <p role="status" className="rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
          {r.error}
        </p>
      )}

      <Section title={r.baseTitle}>
        <ul className="flex flex-col">
          <RuleRow label={r.baseTitle} rule={r.baseRule} value={formatPoints(rules.base_points)} />
        </ul>
      </Section>

      <Section title={r.rarityTitle}>
        <p className="text-sm text-muted">{r.rarityIntro}</p>
        <ul className="flex flex-col" data-testid="rarity-categories">
          {CATEGORIES.map((category) => (
            <RuleRow
              key={category}
              label={r.categories[category].label}
              rule={categoryRule(category)}
              value={`+${formatPoints(categoryBonus(category, rules))}`}
              gold={category === "remarquable" || category === "tres_rare"}
            />
          ))}
        </ul>
      </Section>

      <Section title={r.tiersTitle}>
        <ul className="flex flex-col gap-2">
          {TIERS.map((tier) => {
            const names = countries.get(tier) ?? [];
            return (
              <li key={tier} className="flex flex-col gap-0.5 rounded-[16px] border border-line bg-card p-3.5">
                <span className="text-[15px] font-bold">
                  {r.tiers[tier]} · <span className="font-semibold text-muted">{r.tierEffect[tier]}</span>
                </span>
                <span className="text-xs text-muted">
                  {names.length > 0
                    ? r.examples(names.slice(0, EXAMPLES_PER_TIER), names.length - EXAMPLES_PER_TIER)
                    : r.tierHint[tier]}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={r.rulesTitle}>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>{r.rules.duplicate(rules.neighbor_radius_m)}</li>
          <li>{r.rules.direct}</li>
          <li>{r.rules.oncePerArea(rules.neighbor_radius_m)}</li>
          <li>{r.rules.daily(rules.daily_publish_limit)}</li>
          <li>{r.rules.ledger}</li>
          <li>{r.rules.ties}</li>
          <li>{r.rules.frozen}</li>
        </ul>
      </Section>

      <Section title={r.exampleTitle}>
        <p className="text-sm text-muted">{r.exampleIntro}</p>
        <PointsBlock eyebrow={r.exampleEyebrow} label={r.exampleLabel} points={example.total} />
        <div className="rounded-[22px] bg-card p-4 md:p-0">
          <PointsBreakdown lines={example.lines} />
        </div>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-normal">{title}</h2>
      {children}
    </section>
  );
}

function RuleRow({ label, rule, value, gold }: { label: string; rule: string; value: string; gold?: boolean }) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-[2px] ${gold ? "bg-gold" : "bg-year"}`} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-muted">{rule}</span>
      </span>
      <span className="shrink-0 font-display text-base">{value}</span>
    </li>
  );
}
