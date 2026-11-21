"use client";

import { useState } from "react";
import { ta } from "@/i18n/admin.fr";
import type { ActionResult, AdminUser } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { USER_ROLES } from "@/lib/validation/admin";
import { ActionMessage } from "./action-message";
import { ConfirmAction } from "./confirm-action";
import { buttonDanger, buttonGhost, cardSm, dangerBadge, neutralBadge } from "./styles";
import { SubmitButton } from "./submit-button";

type Actions = {
  changeRole: (form: FormData) => Promise<ActionResult>;
  setSuspended: (form: FormData) => Promise<ActionResult>;
};

/** Onglet Rôles : pseudo, rôle, suspension, nombre de stickers. Ni email, ni domicile. */
export function UserList({ users, meId, actions }: { users: AdminUser[]; meId: string; actions: Actions }) {
  const [last, setLast] = useState<{ id: string; result: ActionResult } | null>(null);

  return (
    <ul className="flex flex-col gap-2.5">
      {users.map((user) => {
        const isMe = user.id === meId;
        const report = (result: ActionResult) => setLast({ id: user.id, result });
        return (
          <li key={user.id} data-user={user.username} className={cn(cardSm, "flex flex-col gap-2.5")}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-bold">@{user.username}</span>
              {isMe && <span className={neutralBadge}>{ta.roles.you}</span>}
              {user.suspended_at && (
                <span className={dangerBadge}>{ta.roles.suspendedSince(user.suspended_at)}</span>
              )}
              <span className="basis-full text-xs text-muted">
                {ta.roles.stickers(user.spot_count, user.published_count)} · {ta.roles.since(user.created_at)}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <form action={async (form) => report(await actions.changeRole(form))} className="flex flex-1 gap-2">
                <input type="hidden" name="userId" value={user.id} />
                <select
                  name="role"
                  key={user.role}
                  defaultValue={user.role}
                  aria-label={ta.roles.roleLabel(user.username)}
                  className="min-h-11 flex-1 rounded-[12px] border border-line bg-card px-2 text-sm font-semibold"
                >
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ta.roles.role[role]}
                    </option>
                  ))}
                </select>
                <SubmitButton className={buttonGhost}>{ta.save}</SubmitButton>
              </form>

              {!isMe && (
                <form action={async (form) => report(await actions.setSuspended(form))} className="flex flex-wrap gap-2">
                  <input type="hidden" name="userId" value={user.id} />
                  {user.suspended_at ? (
                    <SubmitButton name="suspended" value="false" className={buttonGhost}>
                      {ta.roles.unsuspend}
                    </SubmitButton>
                  ) : (
                    <ConfirmAction
                      trigger={ta.roles.suspend}
                      question={ta.roles.confirmSuspend(user.username)}
                      confirmLabel={ta.roles.confirmSuspendYes}
                      name="suspended"
                      value="true"
                      triggerClassName={buttonDanger}
                      confirmClassName={buttonDanger}
                    />
                  )}
                </form>
              )}
            </div>
            {last?.id === user.id && <ActionMessage result={last.result} />}
          </li>
        );
      })}
    </ul>
  );
}
