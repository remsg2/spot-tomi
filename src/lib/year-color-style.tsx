import { FALLBACK_YEAR_COLOR, isHexColor } from "@/lib/design/color";
import { getCurrentYearColor } from "@/lib/season";

/**
 * Pose la couleur de l'année en cours sur --year, au runtime.
 *
 * Rendu par le layout racine dans un <Suspense> : la couleur dépend de la
 * configuration d'exécution et de la base, elle ne peut donc pas faire partie
 * de la coquille statique produite au build. Le sélecteur `html:root` l'emporte
 * sur la valeur de repli de globals.css (`:root`), quel que soit l'ordre des styles.
 */
export async function YearColorStyle() {
  const color = await getCurrentYearColor();
  // Couleur validée (#RRGGBB) : rien d'autre ne peut entrer dans la feuille de style.
  const safe = isHexColor(color) ? color : FALLBACK_YEAR_COLOR;
  return <style data-year-color={safe}>{`html:root{--year:${safe}}`}</style>;
}
