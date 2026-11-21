"use client";

import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { LocateIcon, MinusIcon, PlusIcon } from "./icons";
import { useMapContext } from "./map-provider";

const squareButton =
  "flex size-11 items-center justify-center bg-card text-text focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-text";

export function ZoomControls({ className }: { className?: string }) {
  const { commands } = useMapContext();
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-[14px] bg-card shadow-card", className)}>
      <button
        type="button"
        aria-label={tm.map.zoomIn}
        onClick={() => commands.current?.zoomIn()}
        className={cn(squareButton, "border-b border-line")}
      >
        <PlusIcon size={18} />
      </button>
      <button type="button" aria-label={tm.map.zoomOut} onClick={() => commands.current?.zoomOut()} className={squareButton}>
        <MinusIcon size={18} />
      </button>
    </div>
  );
}

export function LocateButton({ className }: { className?: string }) {
  const { commands } = useMapContext();
  return (
    <button
      type="button"
      aria-label={tm.map.locate}
      title={tm.map.locate}
      onClick={() => commands.current?.locate()}
      className={cn(squareButton, "rounded-[14px] shadow-card", className)}
    >
      <LocateIcon />
    </button>
  );
}

/** Légende des marqueurs (web), comme la maquette Web. */
export function MapLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-[300px] flex-col gap-2.5 rounded-[18px] bg-card px-4 py-3.5 shadow-card", className)}>
      <span className="text-[11px] font-extrabold tracking-[0.1em] text-muted uppercase">{tm.map.legend.title}</span>
      <div className="flex items-end gap-3.5 text-xs">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-[3px] bg-year" />
          {tm.map.legend.small}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-4 rounded-[4px] bg-year" />
          {tm.map.legend.medium}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-[22px] rounded-[5px] bg-year" />
          {tm.map.legend.large}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span
          aria-hidden="true"
          className="size-4 rounded-[4px] bg-year shadow-[0_0_0_2px_var(--gold),0_0_8px_rgb(233_181_47/0.8)]"
        />
        {tm.map.legend.gold}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span aria-hidden="true" className="relative size-4 shrink-0">
          <span className="absolute inset-0 translate-x-[3px] -translate-y-[3px] rotate-[8deg] rounded-[4px] bg-year brightness-[0.78]" />
          <span className="absolute inset-0 -rotate-[5deg] rounded-[4px] bg-year" />
        </span>
        {tm.map.legend.group}
      </div>
    </div>
  );
}

/** Mentions obligatoires des données OpenStreetMap et des tuiles OpenFreeMap. */
export function MapAttribution({ className }: { className?: string }) {
  return (
    <p className={cn("text-[10px] text-muted", className)}>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
        {tm.map.attribution}
      </a>
      {" · "}
      <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
        {tm.map.attributionTiles}
      </a>
    </p>
  );
}

/** États de la carte (chargement impossible, trop de stickers…) et messages brefs. */
export function MapNotices({ className }: { className?: string }) {
  const { status, message } = useMapContext();
  const notices: string[] = [];
  if (status.noWebgl) notices.push(tm.map.noWebgl);
  if (status.dataError) notices.push(tm.map.dataUnavailable);
  if (status.truncated) notices.push(tm.map.truncated);
  if (status.offlineTiles) notices.push(tm.map.offlineTiles);

  return (
    <div className={cn("pointer-events-none flex flex-col items-center gap-2", className)}>
      <p role="status" aria-live="polite" className={cn(!message && "sr-only")}>
        {message && (
          <span className="pointer-events-auto inline-flex rounded-full bg-band px-3.5 py-2 text-[13px] font-semibold text-white shadow-card">
            {message}
          </span>
        )}
      </p>
      {notices.map((notice) => (
        <p
          key={notice}
          data-testid="map-notice"
          className="pointer-events-auto max-w-[90%] rounded-full bg-card px-3.5 py-1.5 text-center text-xs font-semibold text-muted shadow-card"
        >
          {notice}
        </p>
      ))}
    </div>
  );
}
