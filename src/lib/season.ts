import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { FALLBACK_YEAR_COLOR, isHexColor } from "@/lib/design/color";
import { getPublicEnvResult } from "@/lib/env/server";

/** Étiquette de cache de la couleur de l'année, revalidée par l'admin (updateTag). */
export const SEASON_CACHE_TAG = "season";

/** Délai maximal de lecture de la saison : au-delà, couleur de repli. */
const SEASON_TIMEOUT_MS = 2500;

/**
 * Couleur de l'année en cours (`current_season()`), injectée en variable CSS
 * --year par le layout racine (voir src/lib/year-color-style.tsx).
 *
 * Lue AU RUNTIME UNIQUEMENT : `getPublicEnvResult()` appelle `connection()`
 * avant toute lecture, donc rien n'est exécuté ni figé pendant le build (la
 * même build sert tous les environnements, et la configuration Supabase
 * n'existe qu'au runtime). Repli sur le gris des années sans couleur si
 * Supabase n'est pas configuré ou ne répond pas.
 */
export async function getCurrentYearColor(): Promise<string> {
  const env = await getPublicEnvResult();
  if (!env.ok) return FALLBACK_YEAR_COLOR;
  try {
    return await readCurrentSeasonColor(env.env.supabaseUrl, env.env.supabaseKey);
  } catch {
    return FALLBACK_YEAR_COLOR;
  }
}

/**
 * Lecture mise en cache, appelée seulement après `connection()` : l'URL et la
 * clé publishable (publique, déjà transmise au navigateur par RuntimeEnv)
 * sont passées en arguments et font partie de la clé de cache.
 *
 * - `updateTag(SEASON_CACHE_TAG)` dans la Server Action de l'admin expire
 *   l'entrée immédiatement ;
 * - `revalidate`/`expire` courts bornent le retard des autres instances
 *   serverless (l'invalidation par étiquette peut y être locale) : la nouvelle
 *   couleur est servie partout en moins d'une minute.
 * Une erreur est levée (donc jamais mise en cache) plutôt que de mémoriser le gris.
 */
async function readCurrentSeasonColor(supabaseUrl: string, supabaseKey: string): Promise<string> {
  "use cache";
  cacheTag(SEASON_CACHE_TAG);
  cacheLife({ revalidate: 20, expire: 45 });

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/current_season`, {
    method: "POST",
    headers: { apikey: supabaseKey, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(SEASON_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`current_season : HTTP ${response.status}`);
  const rows = (await response.json()) as Array<{ year?: number; color_hex?: string }>;
  const color = rows[0]?.color_hex;
  if (typeof color !== "string" || !isHexColor(color)) throw new Error("current_season : couleur absente");
  return color.toUpperCase();
}
