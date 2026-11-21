/**
 * Tous les textes de l'interface, regroupés pour une traduction future.
 * Règle : aucun texte visible en dur dans les composants.
 */
export const fr = {
  app: {
    name: "Spot Tomi",
    title: "SPOT TOMI",
    description:
      "La carte du monde des stickers de Tomi, le chat de Pierre. Colle, photographie, marque des points.",
  },
  home: {
    tagline: "Le monde entier, un sticker à la fois.",
    comingSoon: "La carte arrive bientôt.",
    tomiAlt: "Tomi le chat",
  },
  theme: {
    label: "Thème",
    system: "Système",
    light: "Clair",
    dark: "Sombre",
  },
  nav: {
    label: "Navigation principale",
    map: "Carte",
    leaderboard: "Classement",
    add: "Ajouter un sticker",
    album: "Album",
    profile: "Profil",
  },
  points: {
    unit: "pts",
    total: "Total",
    pending: "En attente",
    breakdownTitle: "Détail des points",
  },
  score: {
    rank: (rank: number) => `#${rank}`,
    label: (score: string, rank: number) =>
      `Mon score : ${score} points, ${rank === 1 ? "1er" : `${rank}e`} au classement`,
  },
  cluster: {
    label: (count: number, points: string) =>
      `${count} stickers, ${points} points au total`,
  },
  album: {
    toConquer: (points: number) => `+${points} et plus`,
  },
  sticker: {
    title: "TOMI",
    alt: "Sticker de Tomi le chat",
  },
  env: {
    staging: "Environnement de test",
    local: "Local",
    misconfigured: "Configuration Supabase manquante",
  },
} as const;

export type Messages = typeof fr;
export const t = fr;
