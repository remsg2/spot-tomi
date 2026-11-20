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
  env: {
    staging: "Environnement de test",
    local: "Local",
    misconfigured: "Configuration Supabase manquante",
  },
} as const;

export type Messages = typeof fr;
export const t = fr;
