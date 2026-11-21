import type { Metadata } from "next";
import { BackLink, PrimaryLink, Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";

export const metadata: Metadata = { title: t.notFound.title, robots: { index: false } };

/** Adresse inconnue (ou notFound() sans page 404 plus proche) : retour possible, jamais d'impasse. */
export default function NotFound() {
  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <BackLink href="/" label={t.nav.back} className="absolute top-4 left-4" />
      <Sticker size={160} tilt={-6} band="404" />
      <h1 className="font-display text-3xl font-normal">{t.notFound.title}</h1>
      <p className="text-muted">{t.notFound.body}</p>
      <PrimaryLink href="/">{t.notFound.map}</PrimaryLink>
    </main>
  );
}
