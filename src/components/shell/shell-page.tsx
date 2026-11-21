import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Rendu de secours pendant le préchargement (pages dont l'adresse n'est connue qu'à la requête). */
export function ShellFallback() {
  return <div className="h-dvh w-full bg-bg" aria-hidden="true" />;
}

/**
 * Contenu d'une page dans la colonne du gabarit, avec ses marges : à utiliser par
 * les pages placées sous src/app/(carte)/ (classement, profil…).
 */
export function ShellPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 px-4 pt-4 pb-8 md:px-6 md:pt-0", className)}>{children}</div>;
}
