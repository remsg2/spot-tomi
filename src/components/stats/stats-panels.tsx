import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ts } from "@/i18n/stats.fr";
import { cn } from "@/lib/cn";
import type { ContinentFirst, RarePlace, RecordKey, WorldRecord, WorldStats } from "@/lib/stats/queries";

/** Ordre d'affichage des records ; un record absent affiche « Donnée indisponible ». */
const RECORD_ORDER: RecordKey[] = [
  "highest",
  "most_isolated",
  "rarest",
  "most_liked",
  "top_traveler",
  "longest_distance",
  "latest_conquest",
];

export function StatSection({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} id={id} className="flex flex-col gap-2.5">
      <h2 id={id ? `${id}-title` : undefined} className="font-display text-lg font-normal">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Tuile chiffre + libellé. */
export function StatTile({ value, label, hint, accent }: { value: string; label: string; hint?: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex min-h-[86px] flex-col justify-between gap-1 rounded-[18px] p-3.5",
        accent ? "bg-year text-on-year" : "border border-line bg-card",
      )}
    >
      <span className="font-display text-[28px] leading-none">{value}</span>
      <span className={cn("text-xs font-semibold", accent ? "" : "text-muted")}>
        {label}
        {hint && <span className="block font-normal">{hint}</span>}
      </span>
    </div>
  );
}

export function WorldTiles({ stats }: { stats: WorldStats }) {
  return (
    <div className="grid grid-cols-2 gap-2.5" data-testid="world-stats">
      <StatTile accent value={ts.number(stats.stickers)} label={ts.world.stickers(stats.stickers)} />
      <StatTile
        value={ts.number(stats.countries)}
        label={ts.world.countries}
        hint={ts.world.of(stats.countriesTotal)}
      />
      <StatTile value={`${stats.continents} / ${stats.continentsTotal}`} label={ts.world.continents} />
      <StatTile value={ts.number(stats.editions)} label={ts.world.editions(stats.editions)} />
      <StatTile value={ts.number(stats.members)} label={ts.world.members(stats.members)} />
      <StatTile value={ts.number(stats.contributors)} label={ts.world.contributors(stats.contributors)} />
      <div className="col-span-2">
        <StatTile value={ts.number(stats.distanceKm)} label={ts.world.distance} hint={ts.world.distanceHow} />
      </div>
    </div>
  );
}

export function CountryList({
  items,
  value,
}: {
  items: Array<{ iso2: string; nameFr: string }>;
  value: (index: number) => string;
}) {
  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        <li key={item.iso2} className="flex min-h-11 items-center gap-3 border-b border-line py-1 last:border-b-0">
          <span aria-hidden="true" className="text-xl">
            {flagEmoji(item.iso2)}
          </span>
          <span className="flex-1 text-sm font-semibold">{item.nameFr}</span>
          <span className="text-sm text-muted">{value(index)}</span>
        </li>
      ))}
    </ol>
  );
}

export function RecordList({ records }: { records: WorldRecord[] }) {
  const byKey = new Map(records.map((record) => [record.key, record]));
  return (
    <ul className="flex flex-col gap-2" data-testid="records">
      {RECORD_ORDER.map((key) => {
        const record = byKey.get(key);
        const value = record && record.value !== null ? ts.records.value[key](record.value) : null;
        return (
          <li
            key={key}
            data-record={key}
            className="flex flex-col gap-1 rounded-[16px] border border-line bg-card p-3.5"
            style={record?.color ? ({ "--year": record.color } as CSSProperties) : undefined}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-bold">{ts.records[key]}</span>
              {value && <span className="shrink-0 font-display text-base">{value}</span>}
            </span>
            {record ? (
              <span className="text-xs text-muted">
                {record.spotId && record.spotName ? (
                  <Link href={`/spots/${record.spotId}`} className="font-semibold text-text underline underline-offset-2">
                    {record.spotName}
                  </Link>
                ) : (
                  key === "latest_conquest" && record.detail
                )}
                {record.username && (
                  <>
                    {record.spotId ? " · " : ""}
                    <Link href={`/u/${record.username}`} className="font-semibold text-text underline underline-offset-2">
                      {ts.records.by(record.username)}
                    </Link>
                  </>
                )}
                <span className="block">{ts.records.metric[key]}</span>
              </span>
            ) : (
              <span className="text-xs font-semibold text-muted">{ts.unavailable}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ContinentFirstList({ items }: { items: ContinentFirst[] }) {
  if (items.length === 0) return <p className="text-sm text-muted">{ts.unavailable}</p>;
  return (
    <ul className="flex flex-col">
      {items.map((item) => (
        <li key={item.continent} className="border-b border-line last:border-b-0">
          <Link
            href={`/spots/${item.spotId}`}
            className="flex min-h-12 items-center gap-3 py-1.5"
            style={{ "--year": item.color } as CSSProperties}
          >
            <span aria-hidden="true" className="size-3 shrink-0 rounded-full bg-year" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-bold">{item.label}</span>
              <span className="truncate text-xs text-muted">
                {item.spotName} · {ts.continentFirsts.item(item.countryName, item.username, ts.shortDate(item.at))}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function RarePlaceList({ places }: { places: RarePlace[] }) {
  if (places.length === 0) return <p className="text-sm text-muted">{ts.rarest.empty}</p>;
  return (
    <ol className="flex flex-col" data-testid="rarest-places">
      {places.map((place, index) => (
        <li key={place.id} className="border-b border-line last:border-b-0">
          <Link
            href={`/spots/${place.id}`}
            className="flex min-h-14 items-center gap-3 py-1.5"
            style={{ "--year": place.color } as CSSProperties}
          >
            <span className="w-5 shrink-0 text-center text-sm font-bold text-muted">{index + 1}</span>
            {place.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={place.thumbUrl} alt="" width={44} height={44} loading="lazy" className="size-11 rounded-[10px] object-cover" />
            ) : (
              <span aria-hidden="true" className="size-11 shrink-0 rounded-[10px] bg-year" />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{place.name}</span>
              <span className="truncate text-xs text-muted">
                {[place.categoryLabel, place.reason].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="shrink-0 font-display text-base">{`${ts.number(place.points)} pts`}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** Drapeau en emoji (indicateurs régionaux) d'un code ISO à deux lettres. */
export function flagEmoji(iso2: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso2)) return "🏳️";
  return String.fromCodePoint(...[...iso2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
