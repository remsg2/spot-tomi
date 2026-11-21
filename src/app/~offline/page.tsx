import type { Metadata } from "next";
import { RetryButton } from "@/components/pwa/retry-button";
import { BackLink, Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";
import { tm } from "@/i18n/map.fr";

export const metadata: Metadata = { title: tm.pwa.offlineTitle, robots: { index: false } };

/**
 * Page de secours hors ligne, mise en cache par le service worker à l'installation
 * (src/sw/sw.ts) et servie quand une page n'est pas disponible sans réseau.
 */
export default function OfflinePage() {
  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <BackLink href="/" label={t.nav.back} className="absolute top-4 left-4" />
      <Sticker size={180} tilt={-4} />
      <h1 className="font-display text-3xl font-normal">{tm.pwa.offlineTitle}</h1>
      <p className="text-muted">{tm.pwa.offline}</p>
      <RetryButton />
    </main>
  );
}
