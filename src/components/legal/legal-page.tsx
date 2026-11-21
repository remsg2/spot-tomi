import Link from "next/link";
import { BackLink } from "@/components/ui";
import { t } from "@/i18n/fr";
import { legalFr, type LegalPage } from "@/i18n/legal.fr";

/** Page légale : titre, avertissement de brouillon, sections. Statique (aucune donnée). */
export function LegalDocument({ page }: { page: LegalPage }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <BackLink href="/" label={legalFr.back} />
        <h1 className="font-display text-3xl font-normal">{page.title}</h1>
      </div>
      <p role="note" className="rounded-[14px] border border-dashed border-dash p-3 text-sm font-semibold">
        {legalFr.draft}
      </p>
      <p className="text-xs text-muted">{legalFr.updated(page.updated)}</p>
      {page.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-normal">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-[15px] leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
      <LegalLinks />
    </main>
  );
}

/** Liens vers les trois pages légales (pied des réglages, de la connexion, des pages légales). */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label={t.legal.label} className={className ?? "flex flex-wrap gap-x-4 gap-y-1 text-xs"}>
      <Link href="/confidentialite" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        {t.legal.privacy}
      </Link>
      <Link href="/cgu" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        {t.legal.terms}
      </Link>
      <Link href="/moderation" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
        {t.legal.moderation}
      </Link>
    </nav>
  );
}
