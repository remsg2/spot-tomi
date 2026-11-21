"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo, TabBar } from "@/components/ui";
import { MapArea } from "@/components/map/map-area";
import { PlusIcon } from "@/components/map/icons";
import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { mobileModeFor } from "./routes";
import { SpotDrawer } from "./spot-drawer";
import { useMediaQuery, WIDE_QUERY } from "./use-media-query";

/**
 * Gabarit d'application (spécifications 2.3 et 5 ; contrats §5).
 *
 * - < 768 px : plein écran. Page / : la carte et la barre d'onglets ; fiche lieu :
 *   la carte, et la fiche dans un tiroir qui monte du bas (SpotDrawer) ; autres
 *   pages : la page et la barre d'onglets.
 * - 768-1023 px (tablette) : colonne de 380 px à gauche + carte à droite.
 * - ≥ 1024 px (web) : colonne de 440 px à gauche + carte à droite.
 * La navigation est alors en haut de la colonne.
 *
 * Les pages rendues sous src/app/(carte)/ s'affichent dans la colonne : c'est
 * l'emplacement du classement (étape 7) et de la fiche lieu.
 */
export function AppShell({
  account,
  nav,
  children,
}: {
  /** Score ou lien de connexion (composant serveur, dans un Suspense). */
  account: ReactNode;
  /** Navigation de la colonne (composant serveur, dans un Suspense). */
  nav: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const mode = mobileModeFor(pathname);
  const wide = useMediaQuery(WIDE_QUERY);
  const isHome = pathname === "/";
  const showMap = mode !== "page" || wide;

  const column = (
    <>
        <header className="hidden flex-col gap-4 px-6 pt-[22px] pb-4 md:flex">
          <div className="flex items-center justify-between gap-3">
            {isHome ? (
              <h1 className="font-normal">
                <Logo />
              </h1>
            ) : (
              <Link href="/" className="rounded-[10px]">
                <Logo />
              </Link>
            )}
            {account}
          </div>
          {nav}
          <Link
            href="/spots/new"
            className="relative flex h-[52px] shrink-0 items-center gap-2.5 overflow-hidden rounded-[16px] bg-year px-[18px] text-on-year"
          >
            <PlusIcon size={22} className="relative" />
            <span className="relative font-display text-base">{tm.shell.addSticker}</span>
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-band [clip-path:polygon(74%_100%,100%_0,100%_100%)]"
            />
          </Link>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
    </>
  );

  return (
    <div data-shell-mode={mode} className="flex h-dvh w-full flex-col overflow-hidden bg-bg md:flex-row">
      {mode === "sheet" ? (
        <SpotDrawer wide={wide}>{column}</SpotDrawer>
      ) : (
        <main
          id="contenu"
          data-testid="shell-column"
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto bg-card md:w-[380px] md:flex-none md:border-r md:border-line lg:w-[440px]",
            mode === "map" && "hidden md:flex",
          )}
        >
          {column}
        </main>
      )}

      <section
        aria-label={tm.map.title}
        data-testid="shell-map"
        className={cn("relative min-h-0 flex-1", mode === "page" && "hidden md:block")}
      >
        {showMap && <MapArea account={account} isHome={isHome} />}
      </section>

      {mode !== "sheet" && <TabBar className="relative z-20 shrink-0" />}
    </div>
  );
}
