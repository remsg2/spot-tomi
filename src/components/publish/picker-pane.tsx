"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { PrimaryButton } from "@/components/ui";
import { tp } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import { distanceMeters, type LatLng } from "@/lib/publish/geo";
import { ArrowLeftIcon } from "./icons";

const PositionPicker = dynamic(() => import("./position-picker"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-soft" />,
});

/** Zoom minimal pour placer un sticker à la main (rue, pas pays). */
export const MIN_PLACE_ZOOM = 13;
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeDesktop(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Vrai à partir de 1024 px (colonne + carte). Faux côté serveur. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/**
 * Cadre du sélecteur de position : plein écran sur mobile quand il est ouvert,
 * moitié droite de la page à partir de 1024 px (toujours visible).
 * - Position GPS : chaque déplacement s'applique tout de suite (200 m au plus).
 * - Sans GPS : « Placer le sticker ici » valide le centre de la carte.
 */
export function PickerPane({
  open,
  onClose,
  origin,
  value,
  fallbackCenter,
  radius,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  origin: LatLng | null;
  value: LatLng | null;
  fallbackCenter: LatLng | null;
  radius: number;
  onChange: (point: LatLng) => void;
}) {
  const isDesktop = useIsDesktop();
  const [draft, setDraft] = useState<{ point: LatLng; zoom: number } | null>(null);
  const adjusting = origin !== null;
  const title = adjusting ? tp.picker.titleAdjust : tp.picker.titlePlace;
  const moved = adjusting && value ? distanceMeters(origin, value) : 0;
  const canPlace = draft !== null && draft.zoom >= MIN_PLACE_ZOOM;

  function handleCenter(point: LatLng, zoom: number) {
    if (adjusting) onChange(point);
    else setDraft({ point, zoom });
  }

  function place() {
    if (!draft) return;
    onChange(draft.point);
    onClose();
  }

  return (
    <section
      aria-label={title}
      className={cn(
        "inset-0 z-40 flex-col bg-bg",
        open ? "fixed flex" : "hidden",
        "lg:relative lg:inset-auto lg:z-auto lg:flex lg:h-dvh",
      )}
      data-testid="picker-pane"
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 lg:hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label={tp.picker.back}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          <ArrowLeftIcon />
        </button>
        <h2 className="font-display text-lg font-normal">{title}</h2>
      </div>

      {(open || isDesktop) && (
        <PositionPicker
          origin={origin}
          value={value}
          fallbackCenter={fallbackCenter}
          radius={radius}
          onCenterChange={handleCenter}
        />
      )}

      <div className="flex flex-col gap-3 border-t border-line bg-card px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] lg:absolute lg:bottom-6 lg:left-1/2 lg:w-[min(480px,calc(100%-48px))] lg:-translate-x-1/2 lg:rounded-[18px] lg:border lg:pb-4 lg:shadow-card-lg">
        <h2 className="hidden font-display text-base font-normal lg:block">{title}</h2>
        <p className="text-[13px] text-muted">{adjusting ? tp.picker.hintAdjust(radius) : tp.picker.hintPlace}</p>
        {adjusting ? (
          <p className="text-[13px] font-bold" aria-live="polite">
            {tp.picker.distance(Math.round(moved), radius)}
          </p>
        ) : (
          !canPlace && <p className="text-[13px] font-bold">{tp.picker.zoomIn}</p>
        )}
        {adjusting ? (
          <PrimaryButton fullWidth onClick={onClose} className="lg:hidden">
            {tp.picker.confirm}
          </PrimaryButton>
        ) : (
          <PrimaryButton fullWidth onClick={place} disabled={!canPlace}>
            {tp.picker.placeHere}
          </PrimaryButton>
        )}
      </div>
    </section>
  );
}
