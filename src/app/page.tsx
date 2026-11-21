import { Suspense } from "react";
import { AccountLink } from "@/components/account/account-link";
import { Logo, Sticker } from "@/components/ui";
import { t } from "@/i18n/fr";

export default function HomePage() {
  return (
    <>
      <header className="flex items-center justify-between px-4 pt-4">
        <Logo />
        <Suspense fallback={null}>
          <AccountLink />
        </Suspense>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-4 py-12 text-center">
        <Sticker size={256} tilt={-3} />
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl tracking-tight">{t.app.title}</h1>
          <p className="text-muted">{t.home.tagline}</p>
          <p className="text-sm text-muted">{t.home.comingSoon}</p>
        </div>
      </main>
    </>
  );
}
