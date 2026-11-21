/**
 * Suivi des erreurs (cahier des charges, section 12 : observabilité) : erreurs
 * d'affichage et échecs d'envoi de photo, inscrits dans le journal d'erreurs de l'app
 * (public.log_app_error, lu dans l'admin « Erreurs »). Sans service externe : rien ne
 * quitte Supabase. Jamais bloquant, jamais de donnée personnelle dans le message.
 */
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ErrorSource = "client" | "upload";

/** Message court et sans données : nom et message de l'erreur, 300 caractères au plus. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 300);
  if (typeof error === "string") return error.slice(0, 300);
  try {
    return JSON.stringify(error).slice(0, 300);
  } catch {
    return "Erreur inconnue";
  }
}

const sent = new Set<string>();

export function reportClientError(source: ErrorSource, error: unknown, path?: string, digest?: string): void {
  if (typeof window === "undefined") return;
  const message = errorMessage(error);
  // Une même erreur n'est envoyée qu'une fois par page.
  const key = `${source}|${message}|${path ?? ""}`;
  if (sent.has(key)) return;
  sent.add(key);
  try {
    void getSupabaseBrowserClient()
      .rpc("log_app_error", {
        p_source: source,
        p_message: message,
        p_digest: digest ?? null,
        p_path: (path ?? window.location.pathname).slice(0, 300),
        p_user_agent: navigator.userAgent.slice(0, 300),
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Configuration absente (tests, build) : rien à faire.
  }
}
