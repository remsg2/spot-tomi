import { Suspense, type ReactNode } from "react";
import { MapProvider } from "@/components/map/map-provider";
import {
  AccountCapsule,
  AccountSkeleton,
  AppShell,
  ShellFallback,
  ShellNav,
  StaffAwareNav,
} from "@/components/shell";

/**
 * Gabarit des pages « carte » : / (carte), /spots/[id] (fiche lieu) et, à venir,
 * le classement et le profil (étape 7) : il suffit de placer leur page sous
 * src/app/(carte)/ pour l'afficher dans la colonne, la carte à droite.
 *
 * La carte vit dans ce gabarit : elle n'est pas recréée en passant d'une fiche à
 * l'autre. Le Suspense extérieur est requis par Cache Components : le gabarit lit
 * l'adresse de la page, inconnue au build pour /spots/[id].
 */
export default function CarteLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <MapProvider>
        <AppShell
          account={
            <Suspense fallback={<AccountSkeleton />}>
              <AccountCapsule />
            </Suspense>
          }
          nav={
            <Suspense fallback={<ShellNav staff={false} />}>
              <StaffAwareNav />
            </Suspense>
          }
        >
          {children}
        </AppShell>
      </MapProvider>
    </Suspense>
  );
}
