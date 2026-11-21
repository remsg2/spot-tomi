/**
 * Éditions annuelles des stickers (cahier des charges V1.1, section 6), telles que
 * renvoyées par `rpc("list_editions")`, et leurs visuels.
 */
import type { EditionOption } from "@/lib/publish/pasted";
import type { EditionRow } from "@/lib/types/database";

/**
 * Visuels officiels livrés avec l'app (public/editions/{année}.webp, 512 px, sans
 * métadonnées). Un visuel envoyé depuis l'admin (bucket « editions ») les remplace.
 */
export const OFFICIAL_EDITION_VISUALS: Readonly<Record<number, string>> = {
  2025: "/editions/2025.webp",
  2026: "/editions/2026.webp",
  2027: "/editions/2027.webp",
};

/** URL du visuel d'une édition : celui de l'admin, sinon l'officiel, sinon null. */
export function editionVisualUrl(year: number, visualPath: string | null, supabaseUrl: string | null): string | null {
  if (visualPath && supabaseUrl) {
    return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/editions/${visualPath}`;
  }
  return OFFICIAL_EDITION_VISUALS[year] ?? null;
}

/** Lignes brutes → éditions valides, de la plus récente à la plus ancienne. */
export function toEditionRows(data: unknown): EditionRow[] {
  if (!Array.isArray(data)) return [];
  return (data as EditionRow[])
    .filter((row) => Number.isInteger(row?.year) && typeof row.color_hex === "string")
    .sort((a, b) => b.year - a.year);
}

/** Éditions que le membre peut choisir en publiant, avec leur visuel. */
export function toEditionOptions(data: unknown, supabaseUrl: string | null = null): EditionOption[] {
  return toEditionRows(data)
    .filter((row) => row.selectable)
    .map((row) => ({
      year: row.year,
      name: row.name,
      colorHex: row.color_hex,
      isCurrent: row.is_current,
      visualUrl: editionVisualUrl(row.year, row.visual_path, supabaseUrl),
    }));
}
