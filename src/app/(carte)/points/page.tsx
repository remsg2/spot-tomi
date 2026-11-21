import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { BackLink, PointsBlock, PointsBreakdown } from "@/components/ui";
import { t } from "@/i18n/fr";
import { rulesFr as r } from "@/i18n/rules.fr";
import { formatPoints } from "@/lib/design/points";
import { getPublicEnvResult } from "@/lib/env/server";
import { DEFAULT_RULES, toRules, ushuaiaExample, type Rules } from "@/lib/points/rules";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: r.title, description: r.metaDescription };

type Tier = "courant" | "lointain" | "rare" | "extreme";
const TIERS: Tier[] = ["courant", "lointain", "rare", "extreme"];
const EXAMPLES_PER_TIER = 5;

/**
 * Barème lisible par tous (spécifications, section 3), avec les valeurs en vigueur
 * (table scoring_rules, réglable dans l'admin) et des pays d'exemple par niveau.
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
  const example = ushuaiaExample(rules);
  const tierValue: Record<Tier, number> = {
    courant: rules.tier_courant,
    lointain: rules.tier_lointain,
    rare: rules.tier_rare,
    extreme: rules.tier_extreme,
  };

  return (
    <>
      {!ok && (
        <p role="status" className="rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
          {r.error}
        </p>
      )}

      <Section title={r.baseTitle}>
        <ul className="flex flex-col gap-2">
          {TIERS.map((tier) => {
            const names = countries.get(tier) ?? [];
            return (
              <li key={tier} className="flex items-center gap-3 rounded-[16px] border border-line bg-card p-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{r.tiers[tier]}</span>
                  <span className="text-xs text-muted">
                    {names.length > 0
                      ? r.examples(names.slice(0, EXAMPLES_PER_TIER), names.length - EXAMPLES_PER_TIER)
                      : r.tierHint[tier]}
                  </span>
                </span>
                <Value>{formatPoints(tierValue[tier])}</Value>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={r.bonusTitle}>
        <ul className="flex flex-col">
          <RuleRow label={r.bonus.firstCountry.label} rule={r.bonus.firstCountry.rule} value={`+${rules.bonus_first_country}`} gold />
          <RuleRow label={r.bonus.firstCity.label} rule={r.bonus.firstCity.rule} value={`+${rules.bonus_first_city}`} />
          <RuleRow
            label={r.bonus.isolation.label}
            rule={r.bonus.isolation.rule(rules.isolation_points_per_10km, rules.isolation_cap)}
            value={r.perTen(rules.isolation_points_per_10km)}
          />
          <RuleRow label={r.bonus.exceptional.label} rule={r.bonus.exceptional.rule} value={`+${rules.bonus_exceptional}`} gold />
          <RuleRow
            label={r.bonus.altitude.label}
            rule={r.bonus.altitude.rule(formatPoints(rules.altitude_threshold_m))}
            value={`+${rules.bonus_altitude}`}
          />
          <RuleRow
            label={r.bonus.home.label}
            rule={r.bonus.home.rule(rules.home_points_per_1000km)}
            value={r.perThousand(rules.home_points_per_1000km)}
          />
        </ul>
      </Section>

      <Section title={r.malusTitle}>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>{r.malus.neighbor(rules.neighbor_radius_m, rules.neighbor_divisor)}</li>
          <li>{r.malus.pending}</li>
          <li>{r.malus.oncePerArea(rules.edit_radius_m)}</li>
          <li>{r.malus.daily(rules.daily_publish_limit)}</li>
          <li>{r.malus.frozen}</li>
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

function Value({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-[10px] bg-year px-2.5 py-1 font-display text-base text-on-year">{children}</span>
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
