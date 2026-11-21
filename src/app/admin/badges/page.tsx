import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgesAdmin } from "@/components/admin/badges-admin";
import { sectionTitle } from "@/components/admin/styles";
import { adminBadgesFr as b, ta } from "@/i18n/admin.fr";
import { requireStaff } from "@/lib/admin/auth";
import { getBadges } from "@/lib/admin/data";
import { saveBadgeAction } from "../actions";
import { AdminSkeleton } from "../skeleton";

export const metadata: Metadata = { title: ta.tabs.badges };

/** Onglet Badges (admin) : cahier des charges 11, « Gérer les badges ». */
export default function BadgesPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <BadgesContent />
    </Suspense>
  );
}

async function BadgesContent() {
  await requireStaff("admin", "/admin/badges");
  const badges = await getBadges();
  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className={sectionTitle}>{b.title}</h2>
        <p className="text-sm text-muted">{b.intro}</p>
      </div>
      <BadgesAdmin badges={badges} action={saveBadgeAction} />
    </>
  );
}
