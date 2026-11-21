"use client";

import { useEffect } from "react";
import { BackLink, PrimaryButton, Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";
import { reportClientError } from "@/lib/errors/report";

/** Erreur inattendue d'une page : nouvel essai ou retour, sans détail technique. Inscrite au journal d'erreurs. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError("client", error, undefined, error.digest);
  }, [error]);
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
