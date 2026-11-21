"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { cn } from "@/lib/cn";

/** Navigation API (Chrome, Edge, Safari et Firefox récents) : vrai s'il existe une page précédente de l'app. */
function canGoBackInApp(): boolean {
  const navigation = (window as Window & { navigation?: { canGoBack?: boolean } }).navigation;
  return navigation?.canGoBack === true;
}

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
  className?: string;
};

/**
 * Bouton retour rond (44 px) des pages sans barre d'onglets ni navigation :
 * aucune page ne laisse l'utilisateur sans moyen de repartir.
 */
export function BackLink({ href, label, history = true, variant = "outline", className }: BackLinkProps) {
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
        <path d="m15 5-7 7 7 7" />
      </svg>
    </Link>
  );
}
