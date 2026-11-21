/**
 * Éditions annuelles des stickers (cahier des charges V1.1, section 6), telles que
 * renvoyées par `rpc("list_editions")`.
 */
import type { EditionOption } from "@/lib/publish/pasted";
import type { EditionRow } from "@/lib/types/database";

/** Lignes brutes → éditions valides, de la plus récente à la plus ancienne. */
export function toEditionRows(data: unknown): EditionRow[] {
  if (!Array.isArray(data)) return [];
  return (data as EditionRow[])
    .filter((row) => Number.isInteger(row?.year) && typeof row.color_hex === "string")
    .sort((a, b) => b.year - a.year);
}

/** Éditions que le membre peut choisir en publiant. */
export function toEditionOptions(data: unknown): EditionOption[] {
  return toEditionRows(data)
    .filter((row) => row.selectable)
    .map((row) => ({ year: row.year, name: row.name, colorHex: row.color_hex, isCurrent: row.is_current }));
}
