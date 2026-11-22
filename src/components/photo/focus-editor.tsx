"use client";

import { useState, useTransition } from "react";
import { photoFr as tp } from "@/i18n/photo.fr";
import { cn } from "@/lib/cn";
import { sameFocus, type PhotoFocus } from "@/lib/photo/focus";
import { FocusPicker } from "./focus-picker";

export type FocusSaveResult = { ok: boolean; message: string };

/**
 * Recadrage d'une photo déjà publiée (auteur, modérateur) : repère touché sur la photo
 * entière, puis enregistrement. « Recentrer » revient au centre.
 */
export function FocusEditor({
  src,
  initial,
  save,
  onDone,
  audience = "me",
  buttonClassName,
}: {
  src: string;
  initial: PhotoFocus | null;
  save: (focus: PhotoFocus | null) => Promise<FocusSaveResult>;
  onDone?: () => void;
  audience?: "me" | "other";
  buttonClassName?: string;
}) {
  const [focus, setFocus] = useState<PhotoFocus | null>(initial);
  const [saved, setSaved] = useState<PhotoFocus | null>(initial);
  const [result, setResult] = useState<FocusSaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = !sameFocus(focus, saved);

  function submit() {
    startTransition(async () => {
      let outcome: FocusSaveResult;
      try {
        outcome = await save(focus);
      } catch {
        outcome = { ok: false, message: tp.focus.error };
      }
      setResult(outcome);
      if (outcome.ok) {
        setSaved(focus);
        onDone?.();
      }
    });
  }

  return (
    <div className="flex flex-col gap-2.5" data-testid="focus-editor">
      <FocusPicker
        src={src}
        value={focus}
        audience={audience}
        onChange={(next) => {
          setFocus(next);
          setResult(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!changed || pending}
          className={cn(
            "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold disabled:opacity-50",
            buttonClassName ?? "bg-year text-on-year",
          )}
        >
          {pending ? tp.focus.saving : tp.focus.save}
        </button>
        {result && (
          <p role="status" className={cn("text-sm", result.ok ? "text-muted" : "font-bold")}>
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}
