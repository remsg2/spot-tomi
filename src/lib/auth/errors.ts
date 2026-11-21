import { t } from "@/i18n/fr";

type AuthErrorLike = { code?: string | null; message?: string | null } | null | undefined;

const messages: Record<string, string> = t.auth.errors;

/** Traduit une erreur Supabase Auth en message français. */
export function authErrorMessage(error: AuthErrorLike): string {
  const code = error?.code ?? "";
  if (code in messages) return messages[code];
  if (code === "email_exists") return messages.user_already_exists;
  return messages.default;
}
