import type { Metadata } from "next";
import { Suspense } from "react";
import { cardSm, neutralBadge, sectionTitle } from "@/components/admin/styles";
import { adminErrorsFr as e, ta } from "@/i18n/admin.fr";
import { requireStaff } from "@/lib/admin/auth";
import { getRecentErrors } from "@/lib/admin/data";
import { cn } from "@/lib/cn";
import { AdminSkeleton } from "../skeleton";

export const metadata: Metadata = { title: ta.tabs.errors };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Paris" });

/**
 * Onglet Erreurs (admin) : journal des erreurs de l'app (cahier des charges 12,
 * observabilité) : serveur (instrumentation Next), navigateur et envois de photos.
 */
export default function ErrorsPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <ErrorsContent />
    </Suspense>
  );
}

async function ErrorsContent() {
  await requireStaff("admin", "/admin/errors");
  const errors = await getRecentErrors(150);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>{e.title}</h2>
        <p className="text-sm text-muted">{e.intro}</p>
      </div>
      {errors.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-dash p-4 text-center text-sm text-muted">{e.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="app-errors">
          {errors.map((error) => (
            <li key={error.id} className={cn(cardSm, "flex flex-col gap-1")}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className={neutralBadge}>{e.source[error.source] ?? error.source}</span>
                <time dateTime={error.created_at}>{dateTime.format(new Date(error.created_at))}</time>
                <span>{e.by(error.username)}</span>
                {error.digest && <span className="font-mono">{error.digest}</span>}
              </div>
              <p className="text-sm font-semibold break-words">{error.message}</p>
              {error.path && <p className="font-mono text-xs break-all text-muted">{error.path}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
