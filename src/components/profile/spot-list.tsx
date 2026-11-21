"use client";

import Link from "next/link";
import { useState } from "react";
import { Sticker } from "@/components/ui";
import { profileFr as p } from "@/i18n/profile.fr";
import { cn } from "@/lib/cn";
import { formatPointLine } from "@/lib/design/points";
import {
  filterSpotsByYear,
  resolveYear,
  spotSubline,
  spotYears,
  type ProfileSpot,
} from "@/lib/profile/spots";

const HIT_AREA = "relative after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']";

/** Stickers du profil, filtrables par année ; ceux en attente ou masqués sont signalés. */
export function SpotList({ spots, isMe }: { spots: ProfileSpot[]; isMe: boolean }) {
  const [wanted, setWanted] = useState<number | null>(null);
  const year = resolveYear(spots, wanted);
  const years = spotYears(spots);
  const shown = filterSpotsByYear(spots, year);

  return (
    <section aria-labelledby="spots-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="spots-title" className="font-display text-lg font-normal">
          {isMe ? p.spots.titleMe : p.spots.titleOther}
        </h2>
        <span className="text-xs text-muted" aria-live="polite">
          {p.spots.count(shown.length)}
        </span>
      </div>

      {years.length > 1 && (
        <div role="group" aria-label={p.spots.filterLabel} className="flex flex-wrap gap-2">
          <FilterChip active={year === null} onClick={() => setWanted(null)}>
            {p.spots.all}
          </FilterChip>
          {years.map((option) => (
            <FilterChip key={option.year} active={year === option.year} onClick={() => setWanted(option.year)}>
              <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: option.color }} />
              {option.year}
            </FilterChip>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted">
          {year !== null ? p.spots.emptyYear(year) : isMe ? p.spots.emptyMe : p.spots.emptyOther}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((spot) => (
            <li key={spot.id} data-spot-year={spot.year} data-spot-status={spot.status}>
              <SpotRow spot={spot} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        HIT_AREA,
        "flex h-[34px] items-center gap-1.5 rounded-full px-3 text-[13px]",
        active ? "bg-text font-bold text-bg" : "border border-line bg-card font-semibold text-text",
      )}
    >
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: "gold" | "soft" | "dark"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        tone === "gold" && "bg-gold text-on-year",
        tone === "soft" && "bg-soft text-text",
        tone === "dark" && "bg-text text-bg",
      )}
    >
      {children}
    </span>
  );
}

function SpotRow({ spot }: { spot: ProfileSpot }) {
  const pending = spot.status === "pending_review";
  const hidden = spot.status === "hidden";
  const gold = spot.isFirstInCountry || spot.isExceptional;
  return (
    <Link
      href={`/spots/${spot.id}`}
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text",
        pending || hidden ? "border-dashed border-dash" : "border-line",
      )}
    >
      <Sticker size={44} color={spot.colorHex} gold={gold && !pending && !hidden} tilt={-4} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-bold">{spot.name}</span>
        <span className="truncate text-xs text-muted">{spotSubline(spot)}</span>
        {(pending || hidden || spot.isFirstInCountry || spot.isExceptional) && (
          <span className="mt-0.5 flex flex-wrap gap-1">
            {pending && <Badge tone="soft">{p.spots.pending}</Badge>}
            {hidden && <Badge tone="dark">{p.spots.hidden}</Badge>}
            {spot.isFirstInCountry && <Badge tone="gold">{p.spots.first}</Badge>}
            {spot.isExceptional && <Badge tone="gold">{p.spots.exceptional}</Badge>}
          </span>
        )}
      </span>
      {pending ? (
        <span className="shrink-0 text-right text-xs font-bold text-muted" title={p.spots.pendingHint}>
          {p.spots.pending}
        </span>
      ) : (
        <span
          className={cn("shrink-0 font-display text-[17px]", hidden && "text-muted line-through")}
          title={hidden ? p.spots.hiddenHint : undefined}
        >
          {formatPointLine(spot.points)}
        </span>
      )}
    </Link>
  );
}
