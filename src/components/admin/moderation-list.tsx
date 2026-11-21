"use client";

import { useState } from "react";
import type { ActionResult, ModerationEntry } from "@/lib/admin/types";
import { ActionMessage } from "./action-message";
import { ModerationCard, type ModerationActions } from "./moderation-card";

/**
 * Liste de stickers à modérer. Le dernier résultat s'affiche sur la carte
 * concernée, ou en tête de liste si le sticker a quitté la file (validé,
 * supprimé…), pour que le retour ne disparaisse pas avec lui.
 */
export function ModerationList({
  entries,
  empty,
  actions,
}: {
  entries: ModerationEntry[];
  empty: string;
  actions: ModerationActions;
}) {
  const [last, setLast] = useState<{ id: string; result: ActionResult } | null>(null);
  const orphan = last && !entries.some((entry) => entry.id === last.id) ? last.result : null;

  return (
    <div className="flex flex-col gap-2.5">
      <ActionMessage result={orphan} />
      {entries.length === 0 ? (
        <p className="rounded-[18px] border border-dashed border-dash p-4 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((entry) => (
            <li key={entry.id}>
              <ModerationCard
                entry={entry}
                actions={actions}
                result={last?.id === entry.id ? last.result : null}
                onResult={(id, result) => setLast({ id, result })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
