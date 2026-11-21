import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "@/lib/admin/auth";
import { adminHome } from "@/lib/admin/roles";
import { AdminSkeleton } from "./skeleton";

/** /admin : couleur de l'année pour un admin, modération pour un modérateur. */
export default function AdminIndexPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminIndex />
    </Suspense>
  );
}

async function AdminIndex(): Promise<never> {
  const { level } = await requireStaff("moderator", "/admin");
  redirect(adminHome(level));
}
