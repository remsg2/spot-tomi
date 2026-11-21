import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { LoadError } from "@/components/leaderboard/column-page";
import { LeaderboardPanel, LeaderboardSkeleton } from "@/components/leaderboard/leaderboard-panel";
import { RarestSection, ZoneLeaderboard } from "@/components/leaderboard/zone-sections";
import { leaderboardFr as l } from "@/i18n/leaderboard.fr";
import { rulesFr } from "@/i18n/rules.fr";
import { getSessionUser } from "@/lib/auth/server";
import { parseCriterion, parsePeriod } from "@/lib/leaderboard/leaderboard";
import { fetchCurrentSeason, fetchLeaderboard } from "@/lib/leaderboard/queries";
import { parseZone } from "@/lib/stats/queries";

export const metadata: Metadata = {
  title: l.title,
  description: l.metaDescription,
};

/**
 * Classement public : ?periode=toujours|AAAA et ?critere=points|pays|stickers.
 * Rendu dans le gabarit (carte) : plein écran avec la barre d'onglets sur mobile,
 * colonne de gauche et carte à droite à partir de 768 px (maquette Web-dark).
 * Fond --bg sur mobile comme la maquette Classement, --card dans la colonne.
 */
export default function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  return (
    <div className="flex flex-1 flex-col gap-3.5 bg-bg px-4 pt-5 pb-8 [--edge:var(--bg)] md:bg-card md:px-6 md:pt-0 md:[--edge:var(--card)]">
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardContent searchParams={searchParams} />
      </Suspense>
      <p className="text-xs text-muted">{l.tieRule}</p>
      <Link href="/points" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
        {rulesFr.link}
      </Link>
      <Suspense fallback={null}>
        <ZoneContent searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={null}>
        <RarestSection />
      </Suspense>
    </div>
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

async function ZoneContent({ searchParams }: Pick<PageProps<"/leaderboard">, "searchParams">) {
  const params = await searchParams;
  const keep: Record<string, string> = {};
  for (const key of ["periode", "critere"]) {
    const value = params[key];
    if (typeof value === "string") keep[key] = value;
  }
  return <ZoneLeaderboard zone={parseZone(params.zone)} keep={keep} />;
}

async function loadLeaderboard(searchParams: PageProps<"/leaderboard">["searchParams"]) {
  const [params, season, user] = await Promise.all([searchParams, fetchCurrentSeason(), getSessionUser()]);
  const period = parsePeriod(params.periode, season.year);
  const criterion = parseCriterion(params.critere);
  const meId = user?.id ?? null;
  const { entries, participants } = await fetchLeaderboard({ period, criterion, userId: meId });
  return { entries, participants, period, criterion, currentYear: season.year, meId };
}
