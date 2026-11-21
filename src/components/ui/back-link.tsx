"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { canGoBackInApp } from "@/lib/navigation/back";

export type BackLinkProps = {
  /** Page parente, suivie quand il n'y a pas de page précédente dans l'app (lien partagé, ouverture directe). */
  href: string;
  /** Nom accessible du bouton (« Retour », « Retour au profil »…). */
  label: string;
  /**
   * Vrai (défaut) : revient à la page précédente de l'app quand le navigateur sait
   * qu'elle existe, sinon suit `href`. Faux : suit toujours `href`.
   */
  history?: boolean;
  /** « outline » : bordure, sur fond de page. « floating » : ombre, posé sur une photo ou la carte. */
  variant?: "outline" | "floating";
  /** Flèche (retour) ou croix (fermer un tiroir, quitter un écran final). */
  icon?: "back" | "close";
  /** Sans historique : remplace la page courante (pas de retour vers elle). */
  replace?: boolean;
  className?: string;
};

/**
 * Bouton retour rond (44 px) des pages sans barre d'onglets ni navigation :
 * aucune page ne laisse l'utilisateur sans moyen de repartir.
 */
export function BackLink({
  href,
  label,
  history = true,
  variant = "outline",
  icon = "back",
  replace = false,
  className,
}: BackLinkProps) {
  const router = useRouter();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd-clic, clic milieu : nouvel onglet, comme un lien ordinaire.
    if (!history || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (!canGoBackInApp()) return;
    event.preventDefault();
    router.back();
  }

  return (
    <Link
      href={href}
      replace={replace}
      aria-label={label}
      onClick={onClick}
      data-testid="back-link"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text",
        variant === "outline" ? "border border-line" : "shadow-[0_4px_12px_rgb(0_0_0/0.2)]",
        className,
      )}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {icon === "close" ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="m15 5-7 7 7 7" />}
      </svg>
    </Link>
  );
}
