import Link from "next/link";
import { RarePlaceList } from "@/components/stats/stats-panels";
import { leaderboardFr as l } from "@/i18n/leaderboard.fr";
import { formatPoints } from "@/lib/design/points";
import {
  CONTINENT_CODES,
  fetchAreaLeaderboard,
  fetchRarestPlaces,
  fetchWorldConquest,
  zoneParam,
  type Zone,
} from "@/lib/stats/queries";

/**
 * Classement d'un pays ou d'un continent (cahier des charges 7) : formulaire GET qui
 * garde la période et le critère de la page.
 */
export async function ZoneLeaderboard({
  zone,
  keep,
}: {
  zone: Zone | null;
  /** Paramètres d'URL à garder (période, critère). */
  keep: Record<string, string>;
}) {
  const [conquest, entries] = await Promise.all([
    fetchWorldConquest(),
    zone ? fetchAreaLeaderboard(zone) : Promise.resolve(null),
  ]);
  const countries = conquest.filter((country) => country.spotCount > 0);
  const selected = zone ? zoneParam(zone) : "";

  return (
    <section id="zones" aria-labelledby="zones-title" className="flex scroll-mt-4 flex-col gap-3 pt-2">
      <h2 id="zones-title" className="font-display text-lg font-normal">
        {l.zones.title}
      </h2>
      <form action="/leaderboard#zones" method="get" className="flex flex-wrap items-end gap-2">
        {Object.entries(keep).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-bold text-muted">{l.zones.label}</span>
          <select
            name="zone"
            defaultValue={selected}
            className="h-11 rounded-[12px] border border-line bg-card px-3 text-sm font-semibold"
          >
            <option value="">{l.zones.choose}</option>
            <optgroup label={l.zones.continents}>
              {CONTINENT_CODES.map((code) => (
                <option key={code} value={`continent:${code}`}>
                  {l.zones.continent[code]}
                </option>
              ))}
            </optgroup>
            <optgroup label={l.zones.countries}>
              {countries.map((country) => (
                <option key={country.iso2} value={`pays:${country.iso2}`}>
                  {country.nameFr}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <button type="submit" className="h-11 rounded-[12px] bg-text px-4 text-sm font-bold text-bg">
          {l.zones.submit}
        </button>
      </form>
      {zone && entries && (
        entries.length === 0 ? (
          <p className="text-sm text-muted">{l.zones.empty}</p>
        ) : (
          <ol className="flex flex-col" data-testid="zone-leaderboard">
            {entries.map((entry) => (
              <li key={entry.userId} className="border-b border-line last:border-b-0">
                <Link
                  href={`/u/${entry.username}`}
                  aria-label={l.zones.row(entry.rank, entry.username, formatPoints(entry.points), entry.stickers)}
                  className="flex min-h-11 items-center gap-3 py-1"
                >
                  <span className="w-7 shrink-0 text-center font-display text-base">{entry.rank}</span>
                  <span className="flex-1 truncate text-sm font-semibold">{entry.username}</span>
                  <span className="text-xs text-muted">{entry.stickers}</span>
                  <span className="w-20 shrink-0 text-right font-display text-base">{formatPoints(entry.points)}</span>
                </Link>
              </li>
            ))}
          </ol>
        )
      )}
    </section>
  );
}

/** Classement des lieux les plus rares (bonus de rareté, puis points). */
export async function RarestSection() {
  const places = await fetchRarestPlaces(10);
  return (
    <section id="rares" aria-labelledby="rares-title" className="flex scroll-mt-4 flex-col gap-3 pt-2">
      <h2 id="rares-title" className="font-display text-lg font-normal">
        {l.rarest.title}
      </h2>
      <RarePlaceList places={places} />
    </section>
  );
}
