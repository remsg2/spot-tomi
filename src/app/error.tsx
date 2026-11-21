"use client";

import { BackLink, PrimaryButton, Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";

/** Erreur inattendue d'une page : nouvel essai ou retour, sans détail technique. */
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main role="alert" className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-4 py-12 text-center">
      <BackLink href="/" label={t.nav.back} className="absolute top-4 left-4" />
      <Sticker size={140} tilt={5} />
      <h1 className="font-display text-2xl font-normal">{t.error.title}</h1>
      <p className="text-muted">{t.error.body}</p>
      <PrimaryButton onClick={() => retry()}>{t.error.retry}</PrimaryButton>
    </main>
  );
}
