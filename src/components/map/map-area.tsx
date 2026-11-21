"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/ui";
import { tm } from "@/i18n/map.fr";
import { activeFilterCount } from "@/lib/map/filters";
import { FilterChips } from "./filter-chips";
import { FilterDialog } from "./filter-dialog";
import { FiltersIcon } from "./icons";
import { LocateButton, MapAttribution, MapLegend, MapNotices, ZoomControls } from "./map-controls";
import { useMapContext } from "./map-provider";
import { SearchBox } from "./search-box";

/** MapLibre (≈ 1 Mo) n'est chargé que sur les écrans qui affichent la carte. */
const WorldMap = dynamic(() => import("./world-map"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[var(--map-water)]">
      <span className="text-sm font-semibold text-muted">{tm.map.loading}</span>
    </div>
  ),
});

/**
 * Zone de la carte : la carte elle-même et ses commandes. Sous 768 px (page /),
 * l'en-tête (logo, score, recherche, filtres) se superpose à la carte ; à partir
 * de 768 px, les filtres sont au-dessus de la carte et la navigation dans la colonne.
 */
export function MapArea({ account, isHome }: { account: ReactNode; isHome: boolean }) {
  const { filters } = useMapContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const active = activeFilterCount(filters);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--map-water)]">
      <WorldMap />

      {/* Mobile : en-tête superposé (maquette Carte). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 px-4 pt-[calc(16px+env(safe-area-inset-top))] md:hidden">
        <div className="pointer-events-auto flex items-center justify-between gap-3">
          {isHome ? (
            <h1 className="font-normal">
              <Logo />
            </h1>
          ) : (
            <Logo />
          )}
          {account}
        </div>
        <div className="pointer-events-auto flex gap-2">
          <SearchBox className="flex-1" />
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            aria-label={active > 0 ? tm.filters.active(active) : tm.filters.open}
            className="relative flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-card text-text shadow-card"
          >
            <FiltersIcon />
            {active > 0 && (
              <span aria-hidden="true" className="absolute top-2 right-2 size-2.5 rounded-full bg-year ring-2 ring-card" />
            )}
          </button>
        </div>
        <FilterChips variant="mobile" onOpenDialog={() => setDialogOpen(true)} className="pointer-events-auto -mt-1" />
        <MapNotices className="mt-1" />
      </div>

      {/* Tablette et web : filtres au-dessus de la carte, zoom à droite (maquette Web). */}
      <div className="pointer-events-none absolute top-5 right-[84px] left-5 z-10 hidden flex-col gap-2 md:flex">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <SearchBox compact className="w-full max-w-[320px]" />
          <FilterChips variant="web" onOpenDialog={() => setDialogOpen(true)} />
        </div>
        <MapNotices className="items-start" />
      </div>
      <div className="absolute top-5 right-5 z-10 hidden flex-col gap-2 md:flex">
        <ZoomControls />
        <LocateButton />
      </div>
      <MapLegend className="absolute bottom-5 left-5 z-10 hidden lg:flex" />

      {/* Mobile : localisation au-dessus de la barre d'onglets (la fiche s'ouvre dans un tiroir). */}
      <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex flex-col items-end gap-3 md:hidden">
        <LocateButton className="pointer-events-auto" />
      </div>

      <MapAttribution className="absolute right-2 bottom-0.5 z-20" />

      <FilterDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
