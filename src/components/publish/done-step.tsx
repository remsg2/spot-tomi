"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatedPointsBreakdown, Sticker } from "@/components/ui";
import { tp } from "@/i18n/publish.fr";
import { formatPoints } from "@/lib/design/points";
import type { PublishResult } from "@/lib/publish/contract";
import { toPointLines } from "@/lib/publish/points";
import { isPending } from "@/lib/publish/status";
import { ArrowUpIcon } from "./icons";

/** Gain de rang à afficher : seulement s'il y a progrès (ou entrée au classement). */
export function rankMessage(rank: PublishResult["rank"]): string | null {
  if (rank.after === null) return null;
  if (rank.before === null) return tp.done.rankEnter(rank.after);
  return rank.after < rank.before ? tp.done.rankUp(rank.after) : null;
}

/**
 * Écran « Sticker collé » (maquette Bravo) : le sticker se colle avec ses
 * points dans la bande, puis chaque ligne du détail défile avant le total et
 * le gain de rang. Tout est en CSS (globals.css) : avec
 * prefers-reduced-motion, l'écran s'affiche directement, sans animation.
 * Clair : fond couleur de l'année du sticker ; sombre : fond de l'app.
 */
export function DoneStep({ result, onAnother }: { result: PublishResult; onAnother: () => void }) {
  const { spot, lines, rank } = result;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  const pending = isPending(spot.status);
  const band = pending ? tp.done.pendingBand : `+${formatPoints(spot.pointsTotal)}`;
  const pointLines = toPointLines(lines);
  const rankText = pending ? null : rankMessage(rank);
  const after = (offset: number) => ({ "--line-index": pointLines.length + offset }) as CSSProperties;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  async function share() {
    const url = `${window.location.origin}/spots/${spot.id}`;
    const title = tp.done.shareTitle(spot.name);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const confetti = "absolute rounded-[2px]";

  return (
    <div
      className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-year text-on-year dark:bg-bg dark:text-text"
      style={{ "--year": spot.colorHex } as CSSProperties}
      data-testid="done"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[420px] max-w-[440px]">
        <span className={`${confetti} top-[170px] left-10 size-4 rotate-20 rounded-[3px] bg-gold`} />
        <span className={`${confetti} top-[330px] left-[70px] size-2.5 -rotate-30 bg-[#111111] dark:bg-year`} />
        <span className={`${confetti} top-[150px] right-11 size-3 rotate-35 bg-[#111111] dark:bg-year`} />
        <span className={`${confetti} top-[360px] right-[60px] size-[18px] -rotate-12 rounded-[3px] bg-gold`} />
        <span className={`${confetti} top-[260px] right-[30px] size-2 rotate-10 bg-white`} />
      </div>

      <div className="relative mx-auto flex w-full max-w-[440px] flex-1 flex-col items-center gap-[18px] px-5 pt-10 pb-[calc(28px+env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 ref={headingRef} tabIndex={-1} className="font-display text-[34px] leading-[1.05] font-normal outline-none">
            {tp.done.title}
          </h1>
          <span className="text-[15px] font-semibold dark:text-muted">{tp.done.place(spot.city, spot.countryNameFr, spot.name)}</span>
        </div>

        <div className="pt-1.5 pb-1">
          <Sticker
            size={220}
            tilt={6}
            band={band}
            gold={spot.isFirstInCountry || spot.isExceptional}
            animate
            label={tp.done.stickerLabel(band)}
          />
        </div>

        <section aria-label={tp.done.pointsLabel} className="w-full">
          <AnimatedPointsBreakdown lines={pointLines} total={spot.pointsTotal} />
        </section>

        {pending && (
          <p className="animate-line-in text-center text-sm font-semibold" style={after(1.5)}>
            {tp.done.pendingNotice}
          </p>
        )}

        {rankText && (
          <p
            className="animate-line-in flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-[#121212] dark:bg-year"
            style={after(1.5)}
            data-testid="rank"
          >
            <ArrowUpIcon size={18} />
            {rankText}
          </p>
        )}

        <div className="mt-auto flex w-full gap-2.5 pt-2">
          <Link
            href={`/spots/${spot.id}`}
            className="flex h-14 flex-[1.4] items-center justify-center rounded-[18px] bg-[#111111] px-3 text-center font-display text-base text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#111111] dark:shadow-[0_0_0_1px_#3A3A40] dark:focus-visible:outline-text"
          >
            {tp.done.seeOnMap}
          </Link>
          {pending ? (
            <button
              type="button"
              onClick={onAnother}
              className="h-14 flex-1 rounded-[18px] border-2 border-[#111111] bg-transparent px-3 text-[15px] font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#111111] dark:border-text dark:focus-visible:outline-text"
            >
              {tp.done.another}
            </button>
          ) : (
            <button
              type="button"
              onClick={share}
              className="h-14 flex-1 rounded-[18px] border-2 border-[#111111] bg-transparent px-3 text-[15px] font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#111111] dark:border-text dark:focus-visible:outline-text"
            >
              <span aria-live="polite">{copied ? tp.done.shareCopied : tp.done.share}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
