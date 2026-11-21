/** Textes de la page « Comment gagner des points » (/points). */
export const rulesFr = {
  title: "Comment gagner des points",
  metaDescription: "Le barème de Spot Tomi : 100 points par sticker, plus un bonus selon la rareté du lieu.",
  intro:
    "Chaque sticker publié rapporte 100 points, plus un bonus selon la rareté du lieu. Les points sont calculés par le serveur à la publication, puis figés.",
  baseTitle: "Points de base",
  baseRule: "Pour chaque sticker publié, quel que soit le lieu.",
  rarityTitle: "Bonus de rareté",
  rarityIntro:
    "L'indice Spotomi classe chaque lieu dans une catégorie, d'après le pays, l'altitude et la distance à la ville la plus proche (plus de 15 000 habitants). La catégorie la plus haute l'emporte.",
  categories: {
    courant: { label: "Lieu courant ou urbain", rule: "Ville ou lieu fréquenté." },
    touristique: {
      label: "Lieu touristique",
      rule: "Un site touristique ou historique OpenStreetMap à moins de 300 m (musée, monument, point de vue…).",
    },
    remarquable: {
      label: "Site remarquable",
      rule: "Site exceptionnel (patrimoine, monument célèbre) reconnu par un modérateur.",
    },
    isole: {
      label: "Lieu isolé",
      rule: (km: number, m: string) =>
        `Pays rare, à plus de ${km} km de toute ville, au-dessus de ${m} m d'altitude, ou en mer.`,
    },
    tres_rare: {
      label: "Lieu très rare ou difficile d'accès",
      rule: (km: number, m: string) =>
        `Pays très rare (Corée du Nord, Antarctique…), à plus de ${km} km de toute ville, ou au-dessus de ${m} m.`,
    },
  },
  tiersTitle: "Niveau des pays",
  tiers: {
    courant: "Courant",
    lointain: "Lointain",
    rare: "Rare",
    extreme: "Extrême",
  },
  tierEffect: {
    courant: "Pas de bonus par le pays.",
    lointain: "Pas de bonus par le pays.",
    rare: "Lieu isolé au minimum.",
    extreme: "Lieu très rare.",
  },
  tierHint: {
    courant: "Europe de l'Ouest et centrale, États-Unis, Canada",
    lointain: "Tous les pays non classés ailleurs",
    rare: "Pays et îles difficiles d'accès",
    extreme: "Les plus inaccessibles",
  },
  examples: (names: string[], more: number) =>
    more > 0 ? `${names.join(", ")} et ${more} autres` : names.join(", "),
  rulesTitle: "Règles du jeu",
  rules: {
    duplicate: (m: number) =>
      `Doublon : à moins de ${m} m d'un sticker déjà publié, le sticker rapporte les points de base, sans bonus de rareté.`,
    oncePerArea: (m: number) => `Un seul sticker par zone de ${m} m et par jour pour une même personne.`,
    daily: (n: number) => `${n} stickers par jour au maximum.`,
    direct:
      "Publication directe : le sticker est visible tout de suite. Une position placée à la main est vérifiée ensuite par un modérateur.",
    ledger:
      "Chaque changement de points (publication, modération, suppression, correction) est inscrit dans un journal : ton score en est la somme.",
    frozen:
      "Les points sont figés à la publication : un changement de barème ne modifie pas les stickers déjà collés sans recalcul.",
    ties: "À égalité au classement, celui qui a atteint son score le premier passe devant, puis celui qui a le plus de stickers.",
  },
  exampleTitle: "Exemple : les hautes terres d'Islande",
  exampleIntro: "Un sticker collé à 100 km de la ville la plus proche, sans autre sticker autour.",
  exampleEyebrow: "Exemple",
  exampleLabel: "Lieu isolé",
  error: "Le barème n'a pas pu être chargé : voici les valeurs par défaut.",
  link: "Comment sont calculés les points ?",
} as const;
