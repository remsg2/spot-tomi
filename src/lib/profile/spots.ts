/**
 * Liste des stickers d'un profil : logique pure, testée par Vitest.
 */

export type SpotStatus = "published" | "pending_review" | "hidden";

/** Ligne renvoyée par public.profile_spots(p_user), en camelCase. */
export type ProfileSpot = {
  id: string;
  name: string;
  city: string | null;
  countryIso2: string | null;
  countryName: string | null;
  year: number;
  colorHex: string;
  status: SpotStatus;
  points: number;
  isFirstInCountry: boolean;
  isExceptional: boolean;
  takenAt: string;
};

export type YearOption = { year: number; color: string; count: number };

/** Années présentes, de la plus récente à la plus ancienne, avec leur couleur. */
export function spotYears(spots: readonly ProfileSpot[]): YearOption[] {
  const byYear = new Map<number, YearOption>();
  for (const spot of spots) {
    const option = byYear.get(spot.year);
    if (option) option.count += 1;
    else byYear.set(spot.year, { year: spot.year, color: spot.colorHex, count: 1 });
  }
  return [...byYear.values()].sort((a, b) => b.year - a.year);
}

/** Filtre par année (null : toutes), sans changer l'ordre. */
export function filterSpotsByYear(spots: readonly ProfileSpot[], year: number | null): ProfileSpot[] {
  return year === null ? [...spots] : spots.filter((spot) => spot.year === year);
}

/** Année retenue : celle demandée si elle existe encore dans la liste, sinon toutes. */
export function resolveYear(spots: readonly ProfileSpot[], year: number | null): number | null {
  return year !== null && spots.some((spot) => spot.year === year) ? year : null;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** « 3 juin 2027 » (fuseau fixe : même rendu côté serveur et navigateur). */
export function formatSpotDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** « Ushuaïa · Argentine · 3 juin 2027 » (sans les parties inconnues). */
export function spotSubline(spot: Pick<ProfileSpot, "city" | "countryName" | "takenAt">): string {
  return [spot.city, spot.countryName, formatSpotDate(spot.takenAt)].filter(Boolean).join(" · ");
}

/** Points comptés au classement : seuls les stickers publiés. */
export function countsForScore(spot: Pick<ProfileSpot, "status">): boolean {
  return spot.status === "published";
}
