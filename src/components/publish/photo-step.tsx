"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Sticker } from "@/components/ui";
import { tp } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import { ACCEPTED_PHOTO_TYPES } from "@/lib/publish/photo";
import { FlowHeader } from "./flow-header";
import { AlertIcon, CameraIcon, ImageIcon, Spinner } from "./icons";

export type PhotoStepStatus = "idle" | "reading" | "converting";
export type PhotoStepError = keyof typeof tp.photo.errors;

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
  onFile: (file: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const busy = status !== "idle";

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // Même fichier choisi deux fois : l'événement doit se redéclencher.
    event.currentTarget.value = "";
    if (file) onFile(file);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !busy) onFile(file);
  }

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-3.5 px-4 pt-4 pb-8 lg:pt-10">
      <FlowHeader step={1} />

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
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
          <label className={cn(choiceClass, "bg-year text-on-year lg:hidden", busy && "pointer-events-none opacity-50")}>
            <CameraIcon />
            {tp.photo.take}
            <input
              type="file"
              accept={ACCEPTED_PHOTO_TYPES}
              capture="environment"
              className="sr-only"
              disabled={busy}
              onChange={pick}
              data-testid="photo-camera"
            />
          </label>
          <label
            className={cn(
              choiceClass,
              "border border-line bg-bg text-text lg:border-0 lg:bg-year lg:text-on-year",
              busy && "pointer-events-none opacity-50",
            )}
          >
            <ImageIcon />
            {tp.photo.choose}
            <input
              type="file"
              accept={ACCEPTED_PHOTO_TYPES}
              className="sr-only"
              disabled={busy}
              onChange={pick}
              data-testid="photo-input"
            />
          </label>
          <span className="hidden text-[13px] font-semibold text-muted lg:block">
            {dragging ? tp.photo.dropActive : tp.photo.drop}
          </span>
          <span className="text-xs text-muted">{tp.photo.formats}</span>
        </div>
      </div>

      <div aria-live="polite" className="min-h-6">
        {busy && (
          <p className="flex items-center justify-center gap-2 text-sm font-semibold">
            <Spinner />
            {status === "converting" ? tp.photo.converting : tp.photo.reading}
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
