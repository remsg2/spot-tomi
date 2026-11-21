import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadError } from "@/components/leaderboard/column-page";
import {
  ContinentFirstList,
  CountryList,
  RarePlaceList,
  RecordList,
  StatSection,
  WorldTiles,
} from "@/components/stats/stats-panels";
import { ts } from "@/i18n/stats.fr";
import { getSessionUser } from "@/lib/auth/server";
import {
  fetchContinentFirsts,
  fetchRarestPlaces,
  fetchWorldRecords,
  fetchWorldStats,
} from "@/lib/stats/queries";

export const metadata: Metadata = { title: ts.title, description: ts.metaDescription };

/**
 * Onglet Stats (cahier des charges V1.1, section 8) : indicateurs mondiaux, records,
 * premiers Tomis de chaque continent, lieux les plus rares, et un lien vers ses propres
 * statistiques. Valeurs calculées à partir des stickers publiés et non masqués.
 */
export default function StatsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-bg px-4 pt-5 pb-10 md:bg-card md:px-6 md:pt-0">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] leading-tight font-normal">{ts.title}</h1>
        <p className="text-sm text-muted">{ts.intro}</p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[22px] bg-soft" aria-hidden="true" />}>
        <StatsContent />
      </Suspense>
    </div>
  );
}

async function StatsContent() {
  const [stats, records, firsts, rarest, user] = await Promise.all([
    fetchWorldStats(),
    fetchWorldRecords(),
    fetchContinentFirsts(),
    fetchRarestPlaces(5),
    getSessionUser().catch(() => null),
  ]);
  if (!stats) return <LoadError message={ts.error} />;

  return (
    <>
      <StatSection title={ts.world.title} id="monde">
        <WorldTiles stats={stats} />
        <Link href="/?conquete=1" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
          {ts.conquest.mapLink}
        </Link>
      </StatSection>

      {stats.topCountries.length > 0 && (
        <StatSection title={ts.topCountries}>
          <CountryList items={stats.topCountries} value={(i) => ts.number(stats.topCountries[i].count)} />
        </StatSection>
      )}

      {stats.recentConquests.length > 0 && (
        <StatSection title={ts.recentConquests}>
          <CountryList items={stats.recentConquests} value={(i) => ts.shortDate(stats.recentConquests[i].at)} />
        </StatSection>
      )}

      <StatSection title={ts.records.title} id="records">
        <RecordList records={records} />
      </StatSection>

      <StatSection title={ts.continentFirsts.title}>
        <ContinentFirstList items={firsts} />
      </StatSection>

      <StatSection title={ts.rarest.title}>
        <RarePlaceList places={rarest} />
        <Link
          href="/leaderboard#rares"
          className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4"
        >
          {ts.rarest.seeAll}
        </Link>
      </StatSection>

      <StatSection title={ts.me.title}>
        {user ? (
          <Link href="/me#stats" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
            {ts.me.link}
          </Link>
        ) : (
          <Link href="/login?next=%2Fstats" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
            {ts.me.login}
          </Link>
        )}
        <Link href="/fil" className="inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
          {ts.feedLink}
        </Link>
      </StatSection>
    </>
  );
}
