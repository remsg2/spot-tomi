import type { Instrumentation } from "next";
import { parsePublicEnv } from "@/lib/env/schema";

/**
 * Suivi des erreurs du serveur (cahier des charges 12, observabilité) : chaque erreur
 * capturée par Next (rendu, Server Action, route, proxy) est inscrite dans le journal
 * d'erreurs de l'app (public.log_app_error, onglet Erreurs de l'admin). Seuls le
 * message, le digest et le chemin sont envoyés : ni en-têtes, ni cookies, ni corps.
 * Jamais bloquant : un échec d'envoi est ignoré.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const env = parsePublicEnv(process.env);
  if (!env.ok) return;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : null;
  try {
    await fetch(`${env.env.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/log_app_error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.env.supabaseKey,
        Authorization: `Bearer ${env.env.supabaseKey}`,
      },
      body: JSON.stringify({
        p_source: "server",
        p_message: `${message} (${context.routeType} ${context.routePath})`.slice(0, 1000),
        p_digest: digest,
        // Le chemin sans paramètres : ils peuvent contenir des données saisies.
        p_path: request.path.split("?")[0].slice(0, 300),
        p_user_agent: null,
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Journal indisponible : l'erreur reste dans les journaux de Vercel.
  }
};
