import type { AuditEntry } from "./types";

/** Champs techniques qui n'aident pas à lire le journal. */
const HIDDEN_KEYS = new Set(["id", "author_id", "reporter_id", "photo_path", "updated_at"]);

export type AuditChange = { key: string; before: string; after: string };

function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return String(value.length);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Champs modifiés entre « avant » et « après », dans l'ordre de « après ». */
export function auditChanges(entry: Pick<AuditEntry, "before" | "after">): AuditChange[] {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const keys = [...new Set([...Object.keys(after), ...Object.keys(before)])];
  return keys
    .filter((key) => !HIDDEN_KEYS.has(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: show(before[key]), after: show(after[key]) }));
}

/** Ce sur quoi porte l'action : nom du sticker, pseudo, pays, règle… sinon la cible brute. */
export function auditSubject(entry: Pick<AuditEntry, "before" | "after" | "target">): string {
  for (const source of [entry.after, entry.before]) {
    for (const key of ["name", "username", "name_fr", "key"]) {
      const value = source?.[key];
      if (typeof value === "string" && value !== "") return value;
    }
  }
  return entry.target ?? "";
}
