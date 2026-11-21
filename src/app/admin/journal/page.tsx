import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditList } from "@/components/admin/audit-list";
import { sectionTitle } from "@/components/admin/styles";
import { ta } from "@/i18n/admin.fr";
import { requireStaff } from "@/lib/admin/auth";
import { getAuditRecent } from "@/lib/admin/data";
import { AdminSkeleton } from "../skeleton";

export const metadata: Metadata = { title: ta.tabs.journal };

/** Journal récent des actions (lecture admin). */
export default function JournalPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <JournalContent />
    </Suspense>
  );
}

async function JournalContent() {
  await requireStaff("admin", "/admin/journal");
  const entries = await getAuditRecent(100);
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>{ta.journal.title}</h2>
        <p className="text-sm text-muted">{ta.journal.intro}</p>
      </div>
      <AuditList entries={entries} />
    </>
  );
}
