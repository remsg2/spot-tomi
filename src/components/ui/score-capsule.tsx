import Link from "next/link";
import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";
import { formatPoints } from "@/lib/design/points";

export type ScoreCapsuleProps = {
  rank: number;
  score: number;
  href?: string;
  className?: string;
};

/** Pastille noire de l'en-tête : rang et score de l'utilisateur connecté. */
export function ScoreCapsule({ rank, score, href = "/me", className }: ScoreCapsuleProps) {
  const formatted = formatPoints(score);
  return (
    <Link
      href={href}
      aria-label={t.score.label(formatted, rank)}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-full bg-band pr-3.5 pl-1.5 text-white shadow-[0_4px_12px_rgb(0_0_0/0.2)]",
        className,
      )}
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-year text-xs font-extrabold text-on-year">
        {t.score.rank(rank)}
      </span>
      <span className="font-display text-base text-year">{formatted}</span>
      <span className="text-[11px] font-semibold text-[#BDBCB6]">{t.points.unit}</span>
    </Link>
  );
}
