import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ta } from "@/i18n/admin.fr";
import { t } from "@/i18n/fr";
import { getStaffContext } from "@/lib/admin/auth";
import { getModerationCount } from "@/lib/admin/data";

export const metadata: Metadata = {
  // Les modèles de titre ne s'enchaînent pas : le nom de l'app est répété ici.
  title: { default: ta.metaTitle, template: `%s · ${ta.metaTitle} · ${t.app.name}` },
  robots: { index: false, follow: false },
};

/**
 * Gabarit de /admin (maquette Admin) : retour, titre, badge du mode et onglets.
 * Il n'autorise rien : chaque page vérifie elle-même le rôle (requireStaff),
 * et chaque fonction SQL le revérifie.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3.5 px-4 pt-4 pb-12">
      <Suspense fallback={<AdminHeader badge={null} />}>
        <AdminChrome />
      </Suspense>
      {children}
    </main>
  );
}

function AdminHeader({ badge, journal = false }: { badge: string | null; journal?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/me"
        aria-label={ta.back}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-text"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </Link>
      <h1 className="flex-1 font-display text-[26px] font-normal leading-none">{ta.title}</h1>
      {badge && (
        <span className="flex items-center gap-1.5 rounded-full bg-text px-2.5 py-1.5 text-xs font-bold text-bg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3z" />
          </svg>
          {badge}
        </span>
      )}
      {journal && <JournalLink />}
    </div>
  );
}

/** Journal des actions (admin) : hors des quatre onglets de la maquette. */
function JournalLink() {
  return (
    <Link
      href="/admin/journal"
      aria-label={ta.journal.title}
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-text"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </Link>
  );
}

async function AdminChrome() {
  const context = await getStaffContext();
  const level = context.status === "ok" ? context.level : null;
  if (!level) return <AdminHeader badge={null} />;
  const count = await getModerationCount();
  return (
    <>
      <AdminHeader badge={ta.badge[level]} journal={level === "admin"} />
      <AdminTabs level={level} moderationCount={count} />
    </>
  );
}
