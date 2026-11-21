"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";
import { tm } from "@/i18n/map.fr";
import { formatPoints } from "@/lib/design/points";
import { fetchSpotCards, type SpotCard } from "@/lib/map/data";
import { CloseIcon } from "./icons";
import { useMapContext } from "./map-provider";

/**
 * Carte résumée en bas de l'écran (mobile), au toucher d'un marqueur : nom,
 * pays, auteur, date et points. Elle ouvre la fiche complète.
 */
export function SpotSummaryCard() {
  const { summaryId, openSummary, getSupabase } = useMapContext();
  const [card, setCard] = useState<SpotCard | null>(null);

  useEffect(() => {
    if (!summaryId) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const controller = new AbortController();
    fetchSpotCards(supabase, [summaryId], controller.signal)
      .then(([row]) => {
        if (!controller.signal.aborted) setCard(row ?? null);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [summaryId, getSupabase]);

  if (!summaryId) return null;
  const current = card && card.id === summaryId ? card : null;
  const gold = Boolean(current?.is_first_in_country || current?.is_exceptional);
  const badge = current?.is_exceptional
    ? current.altitude_m
      ? `${tm.spot.badges.exceptional} · ${tm.spot.altitude(current.altitude_m)}`
      : tm.spot.badges.exceptional
    : current?.is_first_in_country
      ? tm.spot.badges.firstInCountry
      : null;

  return (
    <div className="relative" data-testid="spot-summary">
      <Link
        href={`/spots/${summaryId}`}
        aria-label={current ? tm.summary.open(current.name) : tm.summary.loading}
        className="relative flex h-[108px] items-center gap-3.5 overflow-hidden rounded-[22px] bg-card px-3.5 text-text shadow-card-lg"
        style={current ? ({ "--year": current.color_hex } as React.CSSProperties) : undefined}
      >
        <Sticker size={76} tilt={-4} gold={gold} className="shrink-0" />
        <span className="flex min-w-0 flex-col gap-[3px] self-start pt-[18px] pr-8">
          {current ? (
            <>
              <span className="truncate font-display text-lg leading-[1.1]">{current.name}</span>
              <span className="truncate text-xs text-muted">
                {[current.country_name_fr ?? current.city, tm.summary.by(current.author_username), tm.spot.shortDate(current.taken_at)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {badge && (
                <span className="mt-1 inline-flex self-start rounded-[6px] bg-gold px-2 py-[3px] text-[11px] font-bold text-on-year">
                  {badge}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted">{tm.summary.loading}</span>
          )}
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-band [clip-path:polygon(64%_100%,100%_34%,100%_100%)]"
        />
        {current && (
          <span className="absolute right-4 bottom-3 flex items-baseline gap-1 text-year">
            <span className="font-display text-[30px] leading-none">+{formatPoints(current.points_total)}</span>
            <span className="text-[11px] font-bold">{t.points.unit}</span>
          </span>
        )}
      </Link>
      <button
        type="button"
        onClick={() => openSummary(null)}
        aria-label={tm.summary.close}
        className="absolute top-1 right-1 flex size-11 items-center justify-center rounded-full text-muted"
      >
        <CloseIcon size={18} />
      </button>
    </div>
  );
}
