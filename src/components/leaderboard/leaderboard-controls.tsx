import Link from "next/link";
import { leaderboardFr as l } from "@/i18n/leaderboard.fr";
import { cn } from "@/lib/cn";
import { CRITERIA, leaderboardHref, type Criterion, type Period } from "@/lib/leaderboard/leaderboard";

/** Zone cliquable portée à 44 px de haut sans changer le dessin (34 px). */
const HIT_AREA = "relative after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']";

type ControlsProps = {
  period: Period;
  criterion: Criterion;
  currentYear: number;
  basePath: string;
  className?: string;
};

/** Année en cours ou « Toujours » (et l'année demandée par l'URL, si autre). */
export function PeriodToggle({ period, criterion, currentYear, basePath, className }: ControlsProps) {
  const options: Array<{ value: Period; label: string }> = [
    { value: String(currentYear) as Period, label: String(currentYear) },
    { value: "all", label: l.periodAll },
  ];
  if (period !== "all" && period !== String(currentYear)) {
    options.unshift({ value: period, label: period });
  }

  return (
    <div role="group" aria-label={l.periodLabel} className={cn("flex shrink-0 rounded-xl bg-soft p-[3px]", className)}>
      {options.map((option) => {
        const active = option.value === period;
        return (
          <Link
            key={option.value}
            href={leaderboardHref({ period: option.value, criterion }, currentYear, basePath)}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              HIT_AREA,
              "flex h-[34px] items-center rounded-[9px] px-3 text-[13px]",
              active ? "bg-year font-extrabold text-on-year" : "font-semibold text-muted",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Points (défaut), pays ou stickers. */
export function CriterionChips({ period, criterion, currentYear, basePath, className }: ControlsProps) {
  return (
    <div role="group" aria-label={l.criterionLabel} className={cn("flex flex-wrap gap-2", className)}>
      {CRITERIA.map((value) => {
        const active = value === criterion;
        return (
          <Link
            key={value}
            href={leaderboardHref({ period, criterion: value }, currentYear, basePath)}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              HIT_AREA,
              "flex h-[34px] items-center rounded-full px-3.5 text-[13px]",
              active ? "bg-text font-bold text-bg" : "border border-line bg-card font-semibold text-text",
            )}
          >
            {l.criteria[value]}
          </Link>
        );
      })}
    </div>
  );
}
