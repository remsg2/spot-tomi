"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapMarker } from "@/components/ui";
import { t } from "@/i18n/fr";
import { tm } from "@/i18n/map.fr";
import { formatPoints } from "@/lib/design/points";
import { fetchSpotCards, type SpotCard } from "@/lib/map/data";
import { useMapContext } from "./map-provider";

const LIST_SIZE = 20;

/**
 * Liste des stickers à l'écran, dans la colonne de gauche (tablette et web) :
 * les plus forts en points d'abord. Suit les déplacements de la carte.
 */
export function VisibleSpotsList() {
  const { visible, getSupabase, selectedId } = useMapContext();
  const [cards, setCards] = useState<SpotCard[]>([]);
  const [loading, setLoading] = useState(false);
  const ids = visible.top.slice(0, LIST_SIZE).map((spot) => spot.id);
  const idsKey = ids.join(",");

  useEffect(() => {
    const wanted = idsKey ? idsKey.split(",") : [];
    const supabase = getSupabase();
    if (!supabase || wanted.length === 0) {
      const timer = setTimeout(() => setCards([]), 0);
      return () => clearTimeout(timer);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetchSpotCards(supabase, wanted, controller.signal)
        .then((rows) => {
          if (!controller.signal.aborted) setCards(rows);
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [idsKey, getSupabase]);

  const pendingById = new Map(visible.top.map((spot) => [spot.id, spot]));
  const rest = Math.max(0, visible.count - cards.length);

  return (
    <section aria-labelledby="visible-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id="visible-title" className="font-display text-xl font-normal">
          {tm.list.title}
        </h2>
        <span className="text-xs text-muted">{tm.map.onScreen(visible.count)}</span>
      </div>
      {visible.count === 0 && !loading && <p className="text-sm text-muted">{tm.list.empty}</p>}
      {loading && cards.length === 0 && <p className="text-sm text-muted">{tm.list.loading}</p>}
      <ul className="flex flex-col gap-1.5" data-testid="visible-spots">
        {cards.map((card) => {
          const spot = pendingById.get(card.id);
          const gold = card.is_first_in_country || card.is_exceptional;
          return (
            <li key={card.id}>
              <Link
                href={`/spots/${card.id}`}
                aria-current={selectedId === card.id ? "true" : undefined}
                className="flex min-h-[62px] items-center gap-3 rounded-[16px] border border-line bg-card px-3 aria-[current=true]:border-text"
              >
                <MapMarker points={card.points_total} color={card.color_hex} gold={gold} pending={spot?.pending} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{card.name}</span>
                  <span className="truncate text-xs text-muted">
                    {[tm.spot.place(card.city, card.country_name_fr), tm.summary.by(card.author_username)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="font-display text-base">
                  {spot?.pending ? t.points.pending : `+${formatPoints(card.points_total)}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {cards.length > 0 && rest > 0 && <p className="text-xs text-muted">{tm.list.more(rest)}</p>}
    </section>
  );
}
