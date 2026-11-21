/**
 * Textes du classement (étape 7), regroupés pour une traduction future.
 * Vocabulaire partagé (unité « pts », navigation) : voir src/i18n/fr.ts.
 */

/** 1 → « 1er », 2 → « 2ᵉ » (typographie française). */
export function ordinalFr(rank: number): string {
  return rank === 1 ? "1er" : `${rank}ᵉ`;
}

export const leaderboardFr = {
  title: "Classement",
  metaDescription: "Le classement des colleurs de stickers de Tomi : points, pays et stickers.",
  periodLabel: "Période",
  periodAll: "Toujours",
  /** Titre en colonne web : « Classement 2027 », « Classement depuis toujours ». */
  titleFor: (period: string | null) =>
    period === null ? "Classement depuis toujours" : `Classement ${period}`,
  criterionLabel: "Critère",
  criteria: {
    points: "Points",
    countries: "Pays",
    stickers: "Stickers",
  },
  participants: (count: number) =>
    count === 0 ? "Aucun participant" : count === 1 ? "1 participant" : `${count} participants`,
  /** « Rémi · toi » : l'utilisateur connecté. */
  you: (username: string) => `${username} · toi`,
  stickers: (count: number) => (count <= 1 ? `${count} sticker` : `${count} stickers`),
  countries: (count: number) => `${count} pays`,
  points: (formatted: string) => `${formatted} pts`,
  podiumLabel: "Podium",
  listLabel: "Classement complet",
  /** Lecture d'écran d'une ligne : « 2ᵉ, Rémi (toi), 1 435 points ». */
  rowLabel: (rank: number, name: string, value: string, isMe: boolean) =>
    `${ordinalFr(rank)}, ${name}${isMe ? " (toi)" : ""}, ${value}`,
  valueLabel: {
    points: (formatted: string) => `${formatted} points`,
    countries: (count: number) => `${count} pays`,
    stickers: (count: number) => (count <= 1 ? `${count} sticker` : `${count} stickers`),
  },
  myRow: "Ta place",
  gap: "Plus bas dans le classement",
  empty: "Aucun sticker validé sur cette période pour l'instant.",
  emptyCta: "Colle le premier !",
  notRanked: "Tu n'es pas encore classé sur cette période : colle un sticker pour entrer dans la course.",
  loading: "Chargement du classement…",
  error: "Le classement n'a pas pu être chargé. Réessaie dans un instant.",
} as const;
