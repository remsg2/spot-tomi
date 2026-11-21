import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-page";
import { legalFr } from "@/i18n/legal.fr";

export const metadata: Metadata = { title: legalFr.terms.title, description: legalFr.terms.description };

/** Page légale (brouillon à faire relire avant l'ouverture au public). */
export default function Page() {
  return <LegalDocument page={legalFr.terms} />;
}
