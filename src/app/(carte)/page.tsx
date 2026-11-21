import type { Metadata } from "next";
import { VisibleSpotsList } from "@/components/map/visible-spots-list";
import { ShellPage } from "@/components/shell";
import { t } from "@/i18n/fr";
import { tm } from "@/i18n/map.fr";

export const metadata: Metadata = {
  title: { absolute: `${t.app.name} · ${tm.map.title}` },
  description: t.app.description,
};

/**
 * Carte mondiale (spécifications 2.3). La carte elle-même est dans le gabarit
 * (src/app/(carte)/layout.tsx) ; la page remplit la colonne de gauche en web :
 * les stickers à l'écran.
 */
export default function MapPage() {
  return (
    <ShellPage>
      <VisibleSpotsList />
    </ShellPage>
  );
}
