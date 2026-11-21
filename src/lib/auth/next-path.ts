/**
 * Chemin de retour après connexion, limité au site lui-même : refuse les URL
 * absolues et « //autre-site » pour éviter les redirections ouvertes.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, "http://spot-tomi.local");
    if (url.origin !== "http://spot-tomi.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
