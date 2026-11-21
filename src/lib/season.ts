import { cacheTag } from "next/cache";
import { FALLBACK_YEAR_COLOR, isHexColor } from "@/lib/design/color";

/** Étiquette de cache de la couleur de l'année (revalidée par l'admin, étape 8). */
export const SEASON_CACHE_TAG = "season";

/**
 * Couleur de l'année en cours, injectée en variable CSS --year par le layout.
 *
 * Étape 2 : la table `seasons` n'existe pas encore (étape 4), donc on renvoie
 * le gris des années sans couleur. À l'étape 8, cette fonction lira
 * `seasons.is_current` ; attention alors à ne lire Supabase qu'au runtime,
 * jamais pendant le build (la build ne dépend d'aucun environnement).
 */
export async function getCurrentYearColor(): Promise<string> {
  "use cache";
  cacheTag(SEASON_CACHE_TAG);
  const color: string = FALLBACK_YEAR_COLOR;
  return isHexColor(color) ? color : FALLBACK_YEAR_COLOR;
}
