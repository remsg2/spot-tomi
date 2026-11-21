"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ts } from "@/i18n/stats.fr";
import { markNoticesRead } from "@/lib/profile/notice-actions";

/** Marque tous les avis comme lus. */
export function MarkNoticesRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNoticesRead();
          router.refresh();
        })
      }
      className="min-h-11 text-xs font-semibold underline underline-offset-4"
    >
      {ts.notices.markRead}
    </button>
  );
}
