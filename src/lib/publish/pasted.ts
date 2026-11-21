/**
 * Date du collage et édition du sticker (cahier des charges V1.1, section 4) : la date
 * est préremplie (date de la photo, sinon du jour) et modifiable ; l'édition est choisie
 * par le membre parmi les éditions disponibles. Mêmes règles que la base
 * (private.pasted_at, private.check_edition).
 */

export type EditionOption = {
  year: number;
  name: string;
  colorHex: string;
  isCurrent: boolean;
  /** Visuel officiel du sticker de cette édition, s'il existe. */
  visualUrl?: string | null;
};

/** « 2026-03-14 » dans le fuseau de l'appareil. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Jour de la photo (heure locale de l'appareil photo « 2026-03-14T16:42:00 »), sinon aujourd'hui. */
export function defaultPastedOn(takenAtLocal: string | null, today: Date): string {
  if (takenAtLocal && /^\d{4}-\d{2}-\d{2}/.test(takenAtLocal)) return takenAtLocal.slice(0, 10);
  return localDay(today);
}

/**
 * Édition proposée : la plus récente qui ne soit pas postérieure à l'année du collage
 * (un sticker 2026 n'a pas pu être collé en 2025), sinon la plus ancienne.
 */
export function defaultEdition(editions: readonly EditionOption[], pastedOn: string): number | null {
  if (editions.length === 0) return null;
  const year = Number(pastedOn.slice(0, 4));
  const years = editions.map((edition) => edition.year).sort((a, b) => b - a);
  return years.find((y) => y <= year) ?? years[years.length - 1];
}

export type PastedError = "invalid" | "future" | "before_edition";

/** Contrôle de la date du collage pour une édition ; null si elle convient. */
export function checkPasted(pastedOn: string, edition: number | null, today: Date): PastedError | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pastedOn) || Number.isNaN(Date.parse(`${pastedOn}T12:00:00Z`))) return "invalid";
  if (pastedOn > localDay(today)) return "future";
  if (edition !== null && Number(pastedOn.slice(0, 4)) < edition) return "before_edition";
  return null;
}

/**
 * Date envoyée au serveur : la date et l'heure de la photo si le jour n'a pas changé,
 * sinon le jour saisi à midi UTC (aucun fuseau ne le fait changer de jour).
 */
export function pastedTakenAt(pastedOn: string, photoTakenAt: string | null, photoDay: string | null): string {
  if (photoTakenAt && photoDay === pastedOn) return photoTakenAt;
  return `${pastedOn}T12:00:00.000Z`;
}
