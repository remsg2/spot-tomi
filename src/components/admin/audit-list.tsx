import { ta } from "@/i18n/admin.fr";
import { auditChanges, auditSubject } from "@/lib/admin/audit";
import type { AuditEntry } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { cardSm } from "./styles";

/** Journal des actions admin : qui, quoi, quand, avant → après. */
export function AuditList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-[18px] border border-dashed border-dash p-4 text-center text-sm text-muted">
        {ta.journal.empty}
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-2">
      {entries.map((entry) => {
        const changes = auditChanges(entry);
        return (
          <li key={entry.id} data-audit-action={entry.action} className={cn(cardSm, "flex flex-col gap-1.5")}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-bold">{ta.journal.actions[entry.action] ?? entry.action}</span>
              <span className="min-w-0 truncate text-sm">{auditSubject(entry)}</span>
            </div>
            <p className="text-xs text-muted">
              <time dateTime={entry.created_at}>{ta.formatDateTime(entry.created_at)}</time> ·{" "}
              {ta.journal.by(entry.actor_username)}
              {entry.target ? (
                <>
                  {" "}
                  · <span className="font-mono">{entry.target}</span>
                </>
              ) : null}
            </p>
            {changes.length > 0 && (
              <table className="w-full text-left text-xs">
                <thead className="sr-only">
                  <tr>
                    <th scope="col">{ta.journal.field}</th>
                    <th scope="col">{ta.journal.before}</th>
                    <th scope="col">{ta.journal.after}</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((change) => (
                    <tr key={change.key} className="align-top">
                      <th scope="row" className="py-0.5 pr-2 font-mono font-normal text-muted">
                        {change.key}
                      </th>
                      <td className="py-0.5 pr-2 break-all">{change.before}</td>
                      <td className="py-0.5 font-semibold break-all">→ {change.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        );
      })}
    </ol>
  );
}
