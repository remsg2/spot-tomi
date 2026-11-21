export type MarkerSize = 26 | 34 | 44;

/** Taille d'un marqueur selon ses points (spécifications, 2.3). */
export function markerSize(points: number): MarkerSize {
  if (points >= 80) return 44;
  if (points >= 20) return 34;
  return 26;
}

const numberFormat = new Intl.NumberFormat("fr-FR");

/** 1435 → « 1 435 » (espace fine insécable, typographie française). */
export function formatPoints(points: number): string {
  return numberFormat.format(points);
}

/** Valeur d'une ligne de détail : la base sans signe, les bonus avec « + ». */
export function formatPointLine(points: number, isBase = false): string {
  if (isBase) return formatPoints(points);
  return points >= 0 ? `+${formatPoints(points)}` : `−${formatPoints(Math.abs(points))}`;
}
