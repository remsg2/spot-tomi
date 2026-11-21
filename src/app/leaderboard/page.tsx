import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ColumnPage, LoadError } from "@/components/leaderboard/column-page";
import { LeaderboardPanel, LeaderboardSkeleton } from "@/components/leaderboard/leaderboard-panel";
import { leaderboardFr as l } from "@/i18n/leaderboard.fr";
import { getSessionUser } from "@/lib/auth/server";
import { parseCriterion, parsePeriod } from "@/lib/leaderboard/leaderboard";
import { fetchCurrentSeason, fetchLeaderboard } from "@/lib/leaderboard/queries";

export const metadata: Metadata = {
  title: l.title,
  description: l.metaDescription,
};

/** Classement public : ?periode=toujours|AAAA et ?critere=points|pays|stickers. */
export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <ColumnPage>
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardContent searchParams={searchParams} />
      </Suspense>
    </ColumnPage>
  );
}

async function LeaderboardContent({ searchParams }: Pick<PageProps<"/leaderboard">, "searchParams">) {
  const data = await loadLeaderboard(searchParams).catch((error: unknown) => {
    // Interruptions internes de Next (prérendu, redirection) : on les laisse passer.
    unstable_rethrow(error);
    console.error("Classement indisponible", error);
    return null;
  });
  if (!data) return <LoadError message={l.error} />;
  return <LeaderboardPanel {...data} />;
}

async function loadLeaderboard(searchParams: PageProps<"/leaderboard">["searchParams"]) {
  const [params, season, user] = await Promise.all([searchParams, fetchCurrentSeason(), getSessionUser()]);
  const period = parsePeriod(params.periode, season.year);
  const criterion = parseCriterion(params.critere);
  const meId = user?.id ?? null;
  const { entries, participants } = await fetchLeaderboard({ period, criterion, userId: meId });
  return { entries, participants, period, criterion, currentYear: season.year, meId };
}
