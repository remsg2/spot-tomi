"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ta } from "@/i18n/admin.fr";
import { cn } from "@/lib/cn";
import { buttonGhost } from "./styles";
import { SubmitButton } from "./submit-button";

/**
 * Action irréversible en deux temps, à placer dans un <form> : le premier
 * bouton affiche la question, le second envoie le formulaire (name/value).
 */
export function ConfirmAction({
  trigger,
  question,
  confirmLabel,
  name,
  value,
  triggerClassName,
  confirmClassName,
}: {
  trigger: ReactNode;
  question: string;
  confirmLabel: string;
  name?: string;
  value?: string;
  triggerClassName: string;
  confirmClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const questionId = useId();

  // La question prend le focus à l'ouverture ; le bouton d'origine le reprend à la fermeture.
  useEffect(() => {
    if (open) confirmRef.current?.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <button ref={triggerRef} type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
    );
  }

  return (
    <div
      ref={confirmRef}
      role="group"
      aria-labelledby={questionId}
      className="flex basis-full flex-col gap-2 rounded-[14px] border border-line bg-soft p-3"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <p id={questionId} className="text-sm font-semibold">
        {question}
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name={name} value={value} className={cn(confirmClassName, "flex-1")}>
          {confirmLabel}
        </SubmitButton>
        <button type="button" className={cn(buttonGhost, "flex-1")} onClick={() => setOpen(false)}>
          {ta.cancel}
        </button>
      </div>
    </div>
  );
}
