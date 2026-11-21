"use client";

import { useEffect } from "react";
import { ta } from "@/i18n/admin.fr";
import { reportClientError } from "@/lib/errors/report";

/** Base injoignable ou lecture refusée : message et nouvel essai, sans détail technique. */
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    reportClientError("client", error, undefined, (error as { digest?: string } | null)?.digest);
  }, [error]);
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-[22px] border border-line bg-card p-4">
      <h2 className="font-display text-lg font-normal">{ta.errors.loadTitle}</h2>
      <p className="text-sm text-muted">{ta.errors.loadIntro}</p>
      <button
        type="button"
        onClick={() => retry()}
        className="min-h-11 rounded-[12px] bg-text px-4 text-sm font-bold text-bg"
      >
        {ta.errors.retry}
      </button>
    </div>
  );
}
