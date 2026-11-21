import type { Metadata } from "next";
import { Suspense } from "react";
import { CountryTiers } from "@/components/admin/country-tiers";
import { RecomputePanel } from "@/components/admin/recompute-panel";
import { RuleForms } from "@/components/admin/rule-forms";
import { sectionTitle } from "@/components/admin/styles";
import { ta } from "@/i18n/admin.fr";
import { requireStaff } from "@/lib/admin/auth";
import { getCountries, getScoringRules } from "@/lib/admin/data";
import { groupRules } from "@/lib/admin/rules";
import {
  recomputeAllAction,
  recomputeSpotAction,
  saveCountryTierAction,
  saveRuleAction,
} from "../actions";
import { AdminSkeleton } from "../skeleton";

export const metadata: Metadata = { title: ta.tabs.scoring };

/** Onglet Barème (admin) : bonus et malus, niveaux des pays, recalcul. */
export default function ScoringPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ScoringContent />
    </Suspense>
  );
}

async function ScoringContent() {
  await requireStaff("admin", "/admin/scoring");
  const [rules, countries] = await Promise.all([getScoringRules(), getCountries()]);
  const tierPoints = Object.fromEntries(
    rules.filter((rule) => rule.key.startsWith("tier_")).map((rule) => [rule.key, rule.value]),
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>{ta.scoring.title}</h2>
        <p className="text-sm text-muted">{ta.scoring.intro}</p>
      </div>
      <RuleForms groups={groupRules(rules)} action={saveRuleAction} />
      <CountryTiers countries={countries} tierPoints={tierPoints} action={saveCountryTierAction} />
      <RecomputePanel recomputeSpot={recomputeSpotAction} recomputeAll={recomputeAllAction} />
    </>
  );
}
