"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent, type DragEvent } from "react";
import { HapticTouch, Sticker } from "@/components/ui";
import { tp } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import { isAppleMobile, type PhotoOrigin } from "@/lib/publish/device-position";
import { ACCEPTED_PHOTO_TYPES } from "@/lib/publish/photo";
import { FlowHeader } from "./flow-header";
import { AlertIcon, CameraIcon, ImageIcon, Spinner } from "./icons";

export type PhotoStepStatus = "idle" | "reading" | "converting" | "locating";
export type PhotoStepError = keyof typeof tp.photo.errors;

const subscribe = () => () => {};

const choiceClass =
  "relative flex min-h-12 cursor-pointer items-center justify-center gap-2.5 rounded-[14px] px-4 text-[15px] font-bold focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-text";

/** Étape 1 / 3 : prendre ou choisir la photo du sticker collé. */
export function PhotoStep({
  status,
  error,
  onFile,
}: {
  status: PhotoStepStatus;
  error: PhotoStepError | null;
  /** `camera` : photo prise à l'instant avec le bouton « Prendre une photo ». */
  onFile: (file: File, origin: PhotoOrigin) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  // Avant l'hydratation, un fichier choisi serait perdu : les choix restent désactivés.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const appleMobile = useSyncExternalStore(subscribe, isAppleMobile, () => false);
  const busy = status !== "idle";
  const disabled = busy || !hydrated;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function pick(event: ChangeEvent<HTMLInputElement>, origin: PhotoOrigin) {
    const file = event.currentTarget.files?.[0];
    // Même fichier choisi deux fois : l'événement doit se redéclencher.
    event.currentTarget.value = "";
    if (file) onFile(file, origin);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !disabled) onFile(file, "library");
  }

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-3.5 px-4 pt-4 pb-8 lg:pt-10">
      <FlowHeader step={1} />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          "flex flex-col items-center gap-5 rounded-[22px] border-2 border-dashed bg-card px-5 pt-8 pb-6 text-center transition-colors",
          dragging ? "border-text" : "border-dash",
        )}
      >
        <Sticker size={132} tilt={-7} />
        <div className="flex flex-col gap-2">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-normal outline-none">
            {tp.photo.heading}
          </h2>
          <p className="text-sm text-muted">{tp.photo.intro}</p>
        </div>

        <div className="flex w-full flex-col gap-2.5" aria-busy={busy}>
          {/* iPhone : interrupteur natif posé sur chaque choix (tic du système), qui ouvre le sélecteur. */}
          <span className="relative flex flex-col lg:hidden">
            <label className={cn(choiceClass, "bg-year text-on-year", disabled && "pointer-events-none opacity-50")}>
              <CameraIcon />
              {tp.photo.take}
              <input
                ref={cameraInput}
                type="file"
                accept={ACCEPTED_PHOTO_TYPES}
                capture="environment"
                className="sr-only"
                disabled={disabled}
                onChange={(event) => pick(event, "camera")}
                data-testid="photo-camera"
              />
            </label>
            <HapticTouch disabled={disabled} onActivate={() => cameraInput.current?.click()} />
          </span>
          <span className="relative flex flex-col">
            <label
              className={cn(
                choiceClass,
                "border border-line bg-bg text-text lg:border-0 lg:bg-year lg:text-on-year",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <ImageIcon />
              {tp.photo.choose}
              <input
                ref={libraryInput}
                type="file"
                accept={ACCEPTED_PHOTO_TYPES}
                className="sr-only"
                disabled={disabled}
                onChange={(event) => pick(event, "library")}
                data-testid="photo-input"
              />
            </label>
            <HapticTouch disabled={disabled} onActivate={() => libraryInput.current?.click()} />
          </span>
          <span className="hidden text-[13px] font-semibold text-muted lg:block">
            {dragging ? tp.photo.dropActive : tp.photo.drop}
          </span>
          {appleMobile && (
            <span data-testid="ios-tip" className="text-xs font-semibold text-muted">
              {tp.photo.iosTip}
            </span>
          )}
          <span className="text-xs text-muted">{tp.photo.formats}</span>
        </div>
      </div>

      <div aria-live="polite" className="min-h-6">
        {busy && (
          <p className="flex items-center justify-center gap-2 text-sm font-semibold">
            <Spinner />
            {status === "converting" ? tp.photo.converting : status === "locating" ? tp.photo.locating : tp.photo.reading}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2.5 rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
          <AlertIcon size={18} className="mt-px shrink-0" />
          {tp.photo.errors[error]}
        </p>
      )}
    </div>
  );
}
