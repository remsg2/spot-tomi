import type { Metadata } from "next";
import { Suspense } from "react";
import { ColumnPage } from "@/components/leaderboard/column-page";
import {
  LeaderboardPanel,
  LeaderboardSkeleton,
  type LeaderboardVariant,
} from "@/components/leaderboard/leaderboard-panel";
import { parseCriterion, parsePeriod } from "@/lib/leaderboard/leaderboard";
import { DevOnly } from "../_etape7/dev-only";
import { DEV_YEAR, leaderboardFixture, type LeaderboardScenario } from "../_etape7/fixtures";

/*
 * Prévisualisation du classement avec des données simulées (développement
 * uniquement ; textes internes hors i18n). Paramètres :
 *   ?periode=toujours|AAAA  ?critere=points|pays|stickers
 *   ?scenario=moi|dehors|visiteur|vide|exaequo  ?vue=auto|podium|list
 */

export const metadata: Metadata = {
  title: "Classement (aperçu)",
  robots: { index: false, follow: false },
};

const SCENARIOS: LeaderboardScenario[] = ["moi", "dehors", "visiteur", "vide", "exaequo"];
const VARIANTS: LeaderboardVariant[] = ["auto", "podium", "list"];

export default function DevLeaderboardPage({ searchParams }: PageProps<"/dev/classement">) {
  return (
    <Suspense fallback={null}>
      <DevOnly>
        <ColumnPage>
          <Suspense fallback={<LeaderboardSkeleton />}>
            <Preview searchParams={searchParams} />
          </Suspense>
        </ColumnPage>
      </DevOnly>
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/classement">, "searchParams">) {
  const params = await searchParams;
  const period = parsePeriod(params.periode, DEV_YEAR);
  const criterion = parseCriterion(params.critere);
  const scenario = SCENARIOS.find((s) => s === params.scenario) ?? "moi";
  const variant = VARIANTS.find((v) => v === params.vue) ?? "auto";
  const { entries, participants, meId, limit } = leaderboardFixture(period, scenario);

  return (
    <LeaderboardPanel
      entries={entries}
      participants={participants}
      period={period}
      criterion={criterion}
      currentYear={DEV_YEAR}
      meId={meId}
      limit={limit}
      variant={variant}
      basePath="/dev/classement"
    />
  );
}
