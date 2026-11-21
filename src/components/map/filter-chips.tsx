"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/i18n/fr";
import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { formatPoints } from "@/lib/design/points";
import { setMine, setPerson, toggleYear } from "@/lib/map/filters";
import { HapticTouch } from "@/components/ui";
import { CloseIcon } from "./icons";
import { useMapContext } from "./map-provider";

/**
 * Pastille de filtre : 34 px de haut à l'écran, mais une cible tactile de 44 px
 * (spécifications 5). `pressed` : filtre actif.
 */
export function Chip({
  pressed,
  onClick,
  children,
  activeStyle,
  label,
  className,
}: {
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Fond du filtre actif (couleur de l'année, or…). */
  activeStyle?: string;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative flex shrink-0", className)}>
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={label}
        onClick={() => {
          haptic("selection");
          onClick();
        }}
        className="group flex h-11 shrink-0 items-center"
      >
        <span
          className={cn(
            "flex h-[34px] items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap shadow-card transition-colors group-focus-visible:outline-3 group-focus-visible:outline-offset-1 group-focus-visible:outline-text",
            pressed ? "font-bold text-on-year" : "bg-card font-semibold text-text",
          )}
          style={pressed ? { background: activeStyle ?? "var(--year)" } : undefined}
        >
          {children}
        </span>
      </button>
      <HapticTouch onActivate={onClick} />
    </span>
  );
}

/** Pastilles de filtres rapides : années, « Rares », personne, « Mes stickers ». */
export function FilterChips({
  variant,
  onOpenDialog,
  className,
}: {
  variant: "mobile" | "web";
  onOpenDialog: () => void;
  className?: string;
}) {
  const { filters, setFilters, seasons, userId, visible } = useMapContext();

  return (
    <div
      role="group"
      aria-label={tm.filters.label}
      className={cn(
        "flex gap-2",
        variant === "mobile" ? "-mx-4 overflow-x-auto px-4 [scrollbar-width:none]" : "flex-wrap",
        className,
      )}
    >
      {seasons.map((season) => {
        const pressed = filters.years.includes(season.year);
        return (
          <Chip
            key={season.year}
            pressed={pressed}
            activeStyle={season.color_hex}
            label={tm.filters.year(season.year)}
            onClick={() => setFilters((previous) => toggleYear(previous, season.year))}
          >
            {!pressed && (
              <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: season.color_hex }} />
            )}
            {season.year}
          </Chip>
        );
      })}
      <Chip
        pressed={filters.rare}
        activeStyle="var(--gold)"
        onClick={() => setFilters((previous) => ({ ...previous, rare: !previous.rare }))}
      >
        {!filters.rare && (
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-gold shadow-[0_0_6px_rgb(233_181_47/0.9)]"
          />
        )}
        {tm.filters.rare}
      </Chip>
      {filters.person ? (
        <Chip
          pressed
          activeStyle="var(--soft)"
          label={tm.filters.clearPerson(filters.person.username)}
          onClick={() => setFilters((previous) => setPerson(previous, null))}
        >
          <span className="text-text">{tm.filters.personOf(filters.person.username)}</span>
          <CloseIcon size={14} className="text-text" />
        </Chip>
      ) : (
        variant === "web" && <Chip onClick={onOpenDialog}>{tm.filters.everyone}</Chip>
      )}
      {userId ? (
        <Chip pressed={filters.mine} onClick={() => setFilters((previous) => setMine(previous, !previous.mine))}>
          {tm.filters.mine}
        </Chip>
      ) : (
        <Link href="/login?next=/" className="group flex h-11 shrink-0 items-center" title={tm.filters.mineLogin}>
          <span className="flex h-[34px] items-center rounded-full bg-card px-3 text-[13px] font-semibold whitespace-nowrap text-muted shadow-card group-focus-visible:outline-3 group-focus-visible:outline-text">
            {tm.filters.mine}
          </span>
        </Link>
      )}
      {variant === "web" && (
        <span
          role="status"
          className="flex h-[34px] shrink-0 items-center gap-1.5 self-center rounded-full bg-band px-3.5 text-[13px] font-semibold whitespace-nowrap text-white"
        >
          {tm.map.onScreen(visible.count)} ·
          <span className="font-display text-year">
            {formatPoints(visible.points)} {t.points.unit}
          </span>
        </span>
      )}
    </div>
  );
}
