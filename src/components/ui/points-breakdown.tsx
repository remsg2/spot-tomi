import type { CSSProperties } from "react";
import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";
import { formatPointLine, formatPoints } from "@/lib/design/points";

export type PointLine = {
  key: string;
  label: string;
  detail?: string;
  points: number;
  /** Points de base du pays : affichés sans « + ». */
  isBase?: boolean;
  /** Puce : grise (base), dorée (premier du pays, exceptionnel) ou couleur de l'année. */
  tone?: "base" | "gold" | "year";
};

const dotClass = {
  base: "bg-muted",
  gold: "bg-gold",
  year: "bg-year",
} as const;

/** Détail des points, ligne par ligne, tel que figé à la publication (fiche lieu). */
export function PointsBreakdown({
  lines,
  title = t.points.breakdownTitle,
  className,
}: {
  lines: PointLine[];
  title?: string;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <h2 className="mb-1 font-display text-base font-normal">{title}</h2>
      <ul>
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex min-h-11 items-center gap-2.5 border-b border-line py-1"
          >
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-[2px]", dotClass[line.tone ?? "year"])}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold">{line.label}</span>
              {line.detail && <span className="text-xs text-muted">{line.detail}</span>}
            </span>
            <span className="font-display text-base">
              {formatPointLine(line.points, line.isBase)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Version animée de l'écran « Sticker collé » : chaque ligne défile, puis le
 * total. En CSS pur ; avec prefers-reduced-motion, tout s'affiche directement.
 */
export function AnimatedPointsBreakdown({
  lines,
  total,
  className,
}: {
  lines: PointLine[];
  total: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col rounded-[22px] bg-panel px-[18px] pt-2.5 pb-3.5 text-[#F4F3EF]",
        className,
      )}
    >
      <ul>
        {lines.map((line, index) => (
          <li
            key={line.key}
            className="animate-line-in flex min-h-[30px] items-center justify-between text-sm"
            style={{ "--line-index": index } as CSSProperties}
          >
            <span className="font-medium text-[#D9D8D2]">{line.label}</span>
            <span className="font-display text-[15px] text-year">
              {formatPointLine(line.points, line.isBase)}
            </span>
          </li>
        ))}
      </ul>
      <div
        className="animate-line-in mt-1.5 flex items-baseline justify-between border-t border-[#34343A] pt-2.5"
        style={{ "--line-index": lines.length + 0.5 } as CSSProperties}
      >
        <span className="text-[13px] font-extrabold tracking-[0.08em] uppercase">
          {t.points.total}
        </span>
        <span className="font-display text-[32px] leading-none text-year">
          {formatPoints(total)} {t.points.unit}
        </span>
      </div>
    </div>
  );
}
