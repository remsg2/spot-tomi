"use client";

import { useId, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { TapIcon } from "@/components/publish/icons";
import { photoFr as tp } from "@/i18n/photo.fr";
import { cn } from "@/lib/cn";
import { focusFromPoint, focusPosition, nudgeFocus, type PhotoFocus } from "@/lib/photo/focus";

/**
 * Photo affichée en entier : toucher (ou cliquer) le sticker pose un repère, qui sert
 * ensuite à centrer l'aperçu recadré. Au clavier : flèches (Maj pour aller plus vite).
 *
 * Pour que la fonction ne passe pas inaperçue : une consigne posée sur la photo tant
 * qu'aucun repère n'existe, le pourquoi en une phrase, et l'aperçu recadré tel qu'il
 * apparaîtra (fiche et vignette), qui montre tout de suite si le sticker est coupé.
 * Rien n'est obligatoire : sans repère, l'aperçu reste centré.
 */
export function FocusPicker({
  src,
  value,
  onChange,
  audience = "me",
  className,
  overlay,
}: {
  src: string;
  value: PhotoFocus | null;
  onChange: (focus: PhotoFocus | null) => void;
  /** « me » : l'auteur (« ton sticker ») ; « other » : un modérateur (« le sticker »). */
  audience?: "me" | "other";
  className?: string;
  /** Bouton posé sur la photo (ex. « Changer la photo »). */
  overlay?: ReactNode;
}) {
  const ids = useId();
  const mine = audience === "me";
  const position = focusPosition(value);

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
    <section
      aria-labelledby={`${ids}-title`}
      className={cn("flex flex-col gap-2.5 rounded-[20px] border border-line bg-card p-3 lg:bg-bg", className)}
      data-testid="focus-picker"
    >
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id={`${ids}-title`} className="text-[15px] leading-tight font-bold">
            {mine ? tp.focus.title : tp.focus.titleOther}
          </h3>
          {mine && (
            <span className="rounded-[6px] bg-year px-1.5 py-0.5 text-[11px] font-extrabold text-on-year">
              {tp.focus.badge}
            </span>
          )}
        </div>
        <p id={`${ids}-why`} className="text-xs leading-[1.4] text-muted">
          {mine ? tp.focus.why : tp.focus.whyOther}
        </p>
      </div>

      <div
        role="group"
        tabIndex={0}
        aria-labelledby={`${ids}-title`}
        aria-describedby={`${ids}-why ${ids}-state`}
        onKeyDown={onKeyDown}
        className="relative flex h-[280px] items-center justify-center overflow-hidden rounded-[16px] bg-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
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
        {!value && (
          // Invitation à toucher la photo, tant qu'aucun repère n'est posé (le toucher passe au travers).
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-3 flex justify-center" data-testid="focus-prompt">
            <span className="flex items-center gap-1.5 rounded-full bg-black/75 py-2 pr-3.5 pl-2.5 text-[13px] font-bold text-white shadow-card-lg">
              <TapIcon size={20} className="motion-safe:animate-bounce" />
              {mine ? tp.focus.prompt : tp.focus.promptOther}
            </span>
          </span>
        )}
        {overlay}
      </div>

      {/* Aperçu recadré tel qu'il apparaîtra : on voit tout de suite si le sticker est coupé. */}
      <div className="flex items-center gap-3" data-testid="focus-preview">
        <figure className="flex shrink-0 flex-col gap-1">
          <span className="block h-[72px] w-[104px] overflow-hidden rounded-[10px] bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
          </span>
          <figcaption className="text-[11px] font-semibold text-muted">{tp.focus.previewSheet}</figcaption>
        </figure>
        <figure className="flex shrink-0 flex-col gap-1">
          <span className="block size-[72px] overflow-hidden rounded-[10px] bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
          </span>
          <figcaption className="text-[11px] font-semibold text-muted">{tp.focus.previewThumb}</figcaption>
        </figure>
        <div className="flex min-w-0 flex-col items-start gap-1 self-start">
          <span className="text-xs font-bold">{tp.focus.previewTitle}</span>
          <p className="text-xs leading-[1.4] text-muted">{value ? tp.focus.previewFocused : tp.focus.previewCentered}</p>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="-ml-1 inline-flex min-h-11 items-center rounded-full px-1 text-xs font-bold underline underline-offset-4"
            >
              {tp.focus.reset}
            </button>
          )}
        </div>
      </div>

      <p className="sr-only">{tp.focus.keyboard}</p>
      <p id={`${ids}-state`} className="sr-only" aria-live="polite">
        {value ? `${tp.focus.set} ${tp.focus.position(value.x, value.y)}` : tp.focus.none}
      </p>
    </section>
  );
}
