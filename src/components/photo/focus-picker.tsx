"use client";

import { useId, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { photoFr as tp } from "@/i18n/photo.fr";
import { cn } from "@/lib/cn";
import { focusFromPoint, nudgeFocus, type PhotoFocus } from "@/lib/photo/focus";

/**
 * Photo affichée en entière : toucher (ou cliquer) le sticker pose un repère, qui sert
 * ensuite à centrer l'aperçu recadré. Au clavier : flèches (Maj pour aller plus vite).
 * Rien n'est obligatoire : sans repère, l'aperçu reste centré sur la photo.
 */
export function FocusPicker({
  src,
  value,
  onChange,
  title = tp.focus.title,
  className,
  overlay,
}: {
  src: string;
  value: PhotoFocus | null;
  onChange: (focus: PhotoFocus | null) => void;
  title?: string;
  className?: string;
  /** Bouton posé sur la photo (ex. « Changer la photo »). */
  overlay?: ReactNode;
}) {
  const ids = useId();

  function pick(event: MouseEvent<HTMLImageElement>) {
    const focus = focusFromPoint(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY);
    if (focus) onChange(focus);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nudgeFocus(value, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    onChange(next);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="focus-picker">
      <div className="flex items-center justify-between gap-2">
        <span id={`${ids}-title`} className="text-xs font-bold text-muted">
          {title}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex min-h-11 items-center rounded-full px-2 text-xs font-bold underline underline-offset-4"
          >
            {tp.focus.reset}
          </button>
        )}
      </div>
      <div
        role="group"
        tabIndex={0}
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-hint ${ids}-state`}
        onKeyDown={onKeyDown}
        className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-[20px] bg-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
      >
        <span className="relative inline-flex max-h-full max-w-full">
          {/* Aperçu local ou photo publique : image entière, jamais recadrée ici. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={tp.focus.label}
            draggable={false}
            onClick={pick}
            className="block max-h-[280px] w-auto max-w-full cursor-crosshair touch-manipulation object-contain select-none"
          />
          {value && (
            <span
              aria-hidden="true"
              data-testid="focus-marker"
              className="pointer-events-none absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_0_0_2px_rgb(0_0_0/0.55),inset_0_0_0_2px_rgb(0_0_0/0.35)]"
              style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
            />
          )}
        </span>
        {overlay}
      </div>
      <p id={`${ids}-hint`} className="text-xs leading-[1.4] text-muted">
        {value ? tp.focus.set : tp.focus.hint} <span className="sr-only">{tp.focus.keyboard}</span>
      </p>
      <p id={`${ids}-state`} className="sr-only" aria-live="polite">
        {value ? tp.focus.position(value.x, value.y) : tp.focus.none}
      </p>
    </div>
  );
}
