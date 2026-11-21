import Link from "next/link";
import type { CSSProperties } from "react";
import { flagEmoji } from "@/components/stats/stats-panels";
import { AlbumTile } from "@/components/ui";
import { profileFr as p } from "@/i18n/profile.fr";
import { ts } from "@/i18n/stats.fr";
import { cn } from "@/lib/cn";
import type { AlbumView } from "@/lib/profile/album";
import type { LedgerLine, Notice } from "@/lib/profile/types";
import type { Badge, MemberStats, PassportStamp } from "@/lib/stats/queries";
import { MarkNoticesRead } from "./notices-client";

/**
 * Passeport (cahier des charges 9.1) : un tampon par pays où le membre a fait voyager
 * Tomi, avec drapeau, date du premier collage et édition ; progression et quelques
 * pays à conquérir. L'ancre #album reste celle de l'ancien album.
 */
export function PassportSection({
  stamps,
  album,
  countriesTotal,
  isMe,
}: {
  stamps: PassportStamp[];
  album: AlbumView;
  countriesTotal: number;
  isMe: boolean;
}) {
  const ratio = countriesTotal > 0 ? Math.min(1, stamps.length / countriesTotal) : 0;
  return (
    <section id="album" aria-labelledby="album-title" className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="album-title" className="font-display text-lg font-normal">
          {ts.passport.title}
        </h2>
        {album.legend.length > 0 && (
          <ul aria-label={p.album.legend} className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 text-[11px] font-semibold text-muted">
            {album.legend.map((item) => (
              <li key={item.year} className="flex items-center gap-1" data-legend-year={item.year}>
                <span aria-hidden="true" className="size-[9px] rounded-[2px]" style={{ background: item.color }} />
                <span aria-hidden="true">{item.short}</span>
                <span className="sr-only">{item.year}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {countriesTotal > 0 && (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={countriesTotal}
            aria-valuenow={stamps.length}
            aria-label={ts.passport.progress(stamps.length, countriesTotal)}
            className="h-2.5 overflow-hidden rounded-full bg-soft"
          >
            <span className="block h-full rounded-full bg-year" style={{ width: `${Math.max(ratio * 100, stamps.length ? 2 : 0)}%` }} />
          </div>
          <span className="text-xs font-semibold text-muted">{ts.passport.progress(stamps.length, countriesTotal)}</span>
        </div>
      )}

      {stamps.length === 0 && <p className="text-sm text-muted">{isMe ? ts.passport.empty : ts.passport.emptyOther}</p>}

      <ul className="grid grid-cols-2 gap-2.5" data-testid="passport">
        {stamps.map((stamp, index) => (
          <li key={stamp.iso2} data-album-tile="conquered">
            <Link
              href={`/spots/${stamp.firstSpotId}`}
              aria-label={ts.passport.stamp(stamp.nameFr, ts.date(stamp.firstPastedAt), stamp.editionName)}
              className="flex h-full flex-col gap-1 rounded-[14px] border-2 border-dashed p-2.5"
              style={
                {
                  borderColor: stamp.color,
                  transform: `rotate(${index % 3 === 0 ? -1.5 : index % 3 === 1 ? 1 : 0}deg)`,
                } as CSSProperties
              }
            >
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-xl leading-none">
                  {flagEmoji(stamp.iso2)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{stamp.nameFr}</span>
                {stamp.pioneer && (
                  <span className="rounded-[5px] bg-gold px-1.5 py-0.5 text-[10px] font-bold text-[#111111]">
                    {ts.passport.pioneer}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-muted">{ts.shortDate(stamp.firstPastedAt)}</span>
              <span className="flex items-center gap-1 text-[11px] font-semibold">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: stamp.color }} />
                {stamp.editionName}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {album.toConquer.length > 0 && (
        <>
          <h3 className="text-sm font-bold text-muted">{ts.passport.toConquer}</h3>
          <ul data-album-grid="" className="grid grid-cols-4 gap-[9px]">
            {album.toConquer.map((tile) => (
              <li key={tile.iso2} data-album-tile="locked">
                <AlbumTile variant="locked" code={tile.iso3} points={tile.points} label={p.album.lockedLabel(tile.nameFr, tile.points)} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Badges débloqués, puis ceux à débloquer (cahier des charges 9.2). */
export function BadgesSection({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;
  const unlocked = badges.filter((badge) => badge.unlocked).length;
  return (
    <section aria-labelledby="badges-title" className="flex flex-col gap-3" data-testid="badges">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges-title" className="font-display text-lg font-normal">
          {ts.badges.title}
        </h2>
        <span className="text-xs font-semibold text-muted">{ts.badges.unlocked(unlocked, badges.length)}</span>
      </div>
      <ul className="grid grid-cols-3 gap-2">
        {badges.map((badge) => (
          <li
            key={badge.code}
            data-badge={badge.code}
            data-unlocked={badge.unlocked}
            className={cn(
              "flex flex-col items-center gap-1 rounded-[14px] border p-2.5 text-center",
              badge.unlocked ? "border-line bg-card" : "border-dashed border-dash opacity-60",
            )}
            title={badge.description}
          >
            <span aria-hidden="true" className={cn("text-2xl", !badge.unlocked && "grayscale")}>
              {badge.icon}
            </span>
            <span className="text-xs leading-tight font-bold">{badge.name}</span>
            <span className="text-[10px] leading-tight text-muted">
              {badge.unlocked && badge.unlockedAt ? ts.shortDate(badge.unlockedAt) : ts.badges.locked}
            </span>
            <span className="sr-only">{badge.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Statistiques personnelles (cahier des charges 8) et progression des points. */
export function MemberStatsSection({
  member,
  progress,
}: {
  member: MemberStats | null;
  progress: Array<{ day: string; points: number }>;
}) {
  if (!member) return null;
  return (
    <section id="stats" aria-labelledby="member-stats-title" className="flex scroll-mt-4 flex-col gap-3" data-testid="member-stats">
      <h2 id="member-stats-title" className="font-display text-lg font-normal">
        {ts.profile.statsTitle}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <Tile value={String(member.continents.length)} label={ts.profile.continents(member.continents.length)} hint={member.continents.map((c) => c.label).join(", ")} />
        <Tile value={String(member.likesReceived)} label={ts.profile.likes(member.likesReceived)} />
        <Tile
          value={member.highest ? ts.profile.altitude(member.highest.altitudeM) : "—"}
          label={ts.profile.highest}
          hint={member.highest?.name ?? ts.unavailable}
          href={member.highest ? `/spots/${member.highest.id}` : undefined}
        />
        <Tile
          value={member.mostIsolated ? ts.profile.km(member.mostIsolated.km) : "—"}
          label={ts.profile.mostIsolated}
          hint={member.mostIsolated?.name ?? ts.unavailable}
          href={member.mostIsolated ? `/spots/${member.mostIsolated.id}` : undefined}
        />
      </div>
      {member.editions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold">{ts.profile.editions}</h3>
          <ul className="flex flex-wrap gap-2">
            {member.editions.map((edition) => (
              <li key={edition.year} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-semibold">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: edition.colorHex }} />
                {ts.profile.editionCount(edition.name, edition.count)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {member.byCountry.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold">{ts.profile.byCountry}</h3>
          <ul className="flex flex-wrap gap-2">
            {member.byCountry.slice(0, 12).map((country) => (
              <li key={country.iso2} className="rounded-full bg-soft px-3 py-1 text-xs font-semibold">
                <span aria-hidden="true">{flagEmoji(country.iso2)} </span>
                {`${country.nameFr} · ${country.count}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ProgressChart progress={progress} />
    </section>
  );
}

function Tile({ value, label, hint, href }: { value: string; label: string; hint?: string; href?: string }) {
  const body = (
    <>
      <span className="font-display text-xl leading-none">{value}</span>
      <span className="text-xs font-semibold text-muted">{label}</span>
      {hint && <span className="truncate text-[11px] text-muted">{hint}</span>}
    </>
  );
  const className = "flex min-h-[78px] flex-col justify-between gap-0.5 rounded-[16px] border border-line bg-card p-3";
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Courbe du score cumulé, jour par jour (journal de points). */
export function ProgressChart({ progress }: { progress: Array<{ day: string; points: number }> }) {
  const width = 320;
  const height = 96;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-bold">{ts.profile.progressTitle}</h3>
      {progress.length === 0 ? (
        <p className="text-sm text-muted">{ts.profile.progressEmpty}</p>
      ) : (
        <figure className="flex flex-col gap-1">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={ts.profile.progressLabel(
              ts.number(progress[progress.length - 1].points),
              ts.date(progress[progress.length - 1].day),
            )}
            className="h-24 w-full overflow-visible"
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              stroke="var(--year)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              points={chartPoints(progress, width, height)}
            />
          </svg>
          <figcaption className="flex justify-between text-[11px] text-muted">
            <span>{ts.shortDate(progress[0].day)}</span>
            <span>{`${ts.number(progress[progress.length - 1].points)} pts`}</span>
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export function chartPoints(progress: Array<{ day: string; points: number }>, width: number, height: number): string {
  if (progress.length === 1) return `0,${height / 2} ${width},${height / 2}`;
  const values = progress.map((item) => item.points);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, min + 1);
  return progress
    .map((item, index) => {
      const x = (index / (progress.length - 1)) * width;
      const y = height - ((item.points - min) / (max - min)) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Avis reçus : décisions de modération, badges, corrections de points. */
export function NoticesSection({ notices }: { notices: Notice[] }) {
  const unread = notices.filter((notice) => notice.readAt === null).length;
  return (
    <section aria-labelledby="notices-title" className="flex flex-col gap-2.5" data-testid="notices">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="notices-title" className="font-display text-lg font-normal">
          {ts.notices.title}
          {unread > 0 && <span className="ml-2 rounded-full bg-year px-2 py-0.5 text-xs text-on-year">{ts.notices.unread(unread)}</span>}
        </h2>
        {unread > 0 && <MarkNoticesRead />}
      </div>
      {notices.length === 0 ? (
        <p className="text-sm text-muted">{ts.notices.empty}</p>
      ) : (
        <ul className="flex flex-col">
          {notices.map((notice) => (
            <li key={notice.id} className="flex flex-col gap-0.5 border-b border-line py-2 last:border-b-0" data-notice={notice.kind}>
              <span className={cn("text-sm", notice.readAt === null ? "font-bold" : "font-semibold")}>
                {notice.spotId && !notice.kind.startsWith("spot_deleted") ? (
                  <Link href={`/spots/${notice.spotId}`} className="underline underline-offset-2">
                    {notice.title}
                  </Link>
                ) : (
                  notice.title
                )}
              </span>
              {notice.body && <span className="text-xs text-muted">{notice.body}</span>}
              <span className="text-[11px] text-muted">{ts.shortDate(notice.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Journal de points du membre connecté : chaque variation et son motif. */
export function LedgerSection({ lines }: { lines: LedgerLine[] }) {
  return (
    <details className="group rounded-[18px] border border-line p-4" data-testid="ledger">
      <summary className="cursor-pointer font-display text-base">{ts.history.title}</summary>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{ts.history.empty}</p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start gap-3 border-b border-line py-2 last:border-b-0">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold break-words">
                  {line.spotId && line.spotName ? <Link href={`/spots/${line.spotId}`}>{line.reason}</Link> : line.reason}
                </span>
                <span className="text-[11px] text-muted">
                  {[ts.shortDate(line.createdAt), line.year].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className={cn("shrink-0 font-display text-base", line.points < 0 && "text-muted")}>
                {line.points > 0 ? `+${ts.number(line.points)}` : ts.number(line.points)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
