import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { BackLink, Logo, TabBar } from "@/components/ui";
import { cn } from "@/lib/cn";

/**
 * Page autonome des étapes 7 (classement, profils) : plein écran avec la barre
 * d'onglets sous 768 px, colonne de 440 px au-delà (comme la colonne du gabarit
 * web). À l'assemblage, le gabarit de l'étape 6 (src/components/shell) remplace
 * ce cadre et reçoit directement les panneaux.
 */
export function ColumnPage({
  children,
  className,
  back,
}: {
  children: ReactNode;
  className?: string;
  /** Bouton retour en haut de la colonne (sous 768 px aussi, sauf `mobile: false`). */
  back?: { href: string; label: string; mobile?: boolean };
}) {
  const backOnMobile = back !== undefined && back.mobile !== false;
  return (
    <div className="flex flex-1 flex-col md:items-center">
      <div
        data-column=""
        className="flex w-full flex-1 flex-col [--edge:var(--bg)] md:min-h-dvh md:max-w-[440px] md:border-x md:border-line md:bg-card md:[--edge:var(--card)]"
      >
        <div className={cn("items-center gap-3 px-4 pt-4 md:flex md:px-6 md:pt-[22px]", backOnMobile ? "flex" : "hidden")}>
          {back && (
            <span className={backOnMobile ? "flex" : "hidden md:flex"}>
              <BackLink href={back.href} label={back.label} />
            </span>
          )}
          <Link href="/" className="hidden rounded-[10px] md:inline-flex">
            <Logo />
          </Link>
        </div>
        <main
          className={cn(
            "flex flex-1 flex-col gap-3.5 px-4 pb-[calc(104px+env(safe-area-inset-bottom))] md:px-6 md:pt-4 md:pb-10",
            backOnMobile ? "pt-3" : "pt-5",
            className,
          )}
        >
          {children}
        </main>
      </div>
      {/* usePathname attend la requête sur les routes dynamiques (/u/[username]). */}
      <Suspense fallback={<TabBarPlaceholder />}>
        <TabBar className="fixed inset-x-0 bottom-0 z-30" />
      </Suspense>
    </div>
  );
}

function TabBarPlaceholder() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 bottom-0 z-30 h-[calc(80px+env(safe-area-inset-bottom))] border-t border-line bg-card md:hidden"
    />
  );
}

/** Message d'erreur de chargement, dans le flux de la page. */
export function LoadError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl border border-line bg-card p-4 text-sm font-semibold">
      {message}
    </p>
  );
}
