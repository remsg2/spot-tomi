import { ta } from "@/i18n/admin.fr";

type DbError = { code?: string | null; message?: string | null } | null | undefined;

/** Codes renvoyés par les fonctions admin (supabase/migrations/20261126000000_admin.sql). */
const messages: Record<string, string> = {
  "42501": ta.errors.forbidden,
  P0002: ta.errors.notFound,
  "22023": ta.errors.invalid,
  ST801: ta.errors.contrast,
  ST802: ta.errors.lastAdmin,
  ST803: ta.errors.selfSuspend,
  ST804: ta.errors.status,
};

/** Message français d'une erreur Supabase/Postgres, sans détail technique. */
export function adminErrorMessage(error: DbError): string {
  const code = error?.code ?? "";
  return messages[code] ?? ta.errors.default;
}
