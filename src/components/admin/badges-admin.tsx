"use client";

import { useState } from "react";
import { adminBadgesFr as b } from "@/i18n/admin.fr";
import type { ActionResult, AdminBadge } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { ActionMessage } from "./action-message";
import { buttonGhost, cardSm, input, neutralBadge } from "./styles";
import { SubmitButton } from "./submit-button";

/** Onglet Badges : activer, renommer et décrire les badges automatiques. */
export function BadgesAdmin({ badges, action }: { badges: AdminBadge[]; action: (form: FormData) => Promise<ActionResult> }) {
  const [last, setLast] = useState<{ code: string; result: ActionResult } | null>(null);
  return (
    <ul className="flex flex-col gap-2.5" data-testid="badges-admin">
      {badges.map((badge) => (
        <li key={badge.code} className={cn(cardSm, "flex flex-col gap-2")}>
          <form action={async (form) => setLast({ code: badge.code, result: await action(form) })} className="flex flex-col gap-2">
            <input type="hidden" name="code" value={badge.code} />
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="text-2xl">
                {badge.icon}
              </span>
              <span className="font-mono text-xs text-muted">{badge.code}</span>
              <span className={neutralBadge}>{b.unlocked(badge.unlocked)}</span>
              <label className="ml-auto flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="active" defaultChecked={badge.active} className="size-5" />
                {b.active}
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              {b.name}
              <input name="name" required maxLength={60} defaultValue={badge.name} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              {b.description}
              <input name="description" required maxLength={200} defaultValue={badge.description} className={input} />
            </label>
            <SubmitButton className={cn(buttonGhost, "self-start")}>{b.save}</SubmitButton>
          </form>
          {last?.code === badge.code && <ActionMessage result={last.result} />}
        </li>
      ))}
    </ul>
  );
}
