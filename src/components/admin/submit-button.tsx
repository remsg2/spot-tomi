"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { ta } from "@/i18n/admin.fr";

/** Bouton d'envoi désactivé pendant l'action du formulaire parent. */
export function SubmitButton({
  children,
  pendingLabel = ta.pending,
  disabled,
  ...props
}: { children: ReactNode; pendingLabel?: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending, data } = useFormStatus();
  // Plusieurs boutons d'envoi dans un même formulaire : seul celui cliqué affiche l'attente.
  const mine = pending && (props.value === undefined || data?.get(String(props.name)) === String(props.value));
  return (
    <button type="submit" disabled={disabled || pending} aria-busy={mine || undefined} {...props}>
      {mine ? pendingLabel : children}
    </button>
  );
}
