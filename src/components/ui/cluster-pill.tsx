import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";
import { formatPoints } from "@/lib/design/points";

export type ClusterPillProps = {
  count: number;
  points: number;
  className?: string;
};

/** Pastille noire d'un groupe de stickers : nombre et total des points. */
export function ClusterPill({ count, points, className }: ClusterPillProps) {
  const total = formatPoints(points);
  return (
    <span
      role="img"
      aria-label={t.cluster.label(count, total)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-band py-2 pr-3 pl-2.5 whitespace-nowrap text-white",
        className,
      )}
      style={{ boxShadow: "0 0 0 3px var(--card), 0 6px 16px rgb(0 0 0 / 0.3)" }}
    >
      <span className="font-display text-base leading-none">{count}</span>
      <span className="text-xs font-bold text-year">
        {total} {t.points.unit}
      </span>
    </span>
  );
}
