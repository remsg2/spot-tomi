/** Textes de la page « Comment gagner des points » (/points). */
export const rulesFr = {
  title: "Comment gagner des points",
  metaDescription: "Le barème de Spot Tomi : points de base par pays, bonus et malus.",
  intro:
    "Chaque sticker rapporte des points selon l'endroit où il est collé. Ils sont calculés au moment de la publication, puis figés.",
  baseTitle: "Points de base selon le pays",
  tiers: {
    courant: "Courant",
    lointain: "Lointain",
    rare: "Rare",
    extreme: "Extrême",
  },
  tierHint: {
    courant: "Europe de l'Ouest et centrale, États-Unis, Canada",
    lointain: "Tous les pays non classés ailleurs",
    rare: "Pays et îles difficiles d'accès",
    extreme: "Les plus inaccessibles",
  },
  countryCount: (n: number) => (n > 1 ? `${n} pays` : `${n} pays`),
  examples: (names: string[], more: number) =>
    more > 0 ? `${names.join(", ")} et ${more} autres` : names.join(", "),
  bonusTitle: "Bonus cumulables",
  bonus: {
    firstCountry: { label: "Premier sticker du pays", rule: "Personne n'en a encore publié dans ce pays." },
    firstCity: { label: "Première ville", rule: "Personne n'en a encore publié dans cette ville." },
    isolation: {
      label: "Isolement",
      rule: (per: number, cap: number) =>
        `+${per} par tranche de 10 km jusqu'au sticker publié le plus proche, plafonné à +${cap}.`,
    },
    exceptional: {
      label: "Lieu exceptionnel",
      rule: "Sommet, monument célèbre, site Unesco : coché par un modérateur après publication.",
    },
    altitude: { label: "Altitude", rule: (m: string) => `Photo prise au-dessus de ${m} m.` },
    home: {
      label: "Loin de chez toi",
      rule: (per: number) =>
        `+${per} par tranche de 1 000 km entre le sticker et ton domicile (si tu l'as renseigné).`,
    },
  },
  perTen: (per: number) => `+${per} / 10 km`,
  perThousand: (per: number) => `+${per} / 1 000 km`,
  malusTitle: "Malus et règles du jeu",
  malus: {
    neighbor: (m: number, d: number) =>
      `À moins de ${m} m d'un autre sticker publié, le total est divisé par ${d} (arrondi à l'entier inférieur).`,
    pending:
      "Sans position GPS ou sans date dans la photo, le sticker attend la validation d'un modérateur : ses points ne comptent pas encore au classement.",
    oncePerArea: (m: number) => `Un seul sticker par zone de ${m} m et par jour pour une même personne.`,
    daily: (n: number) => `${n} stickers par jour au maximum.`,
    frozen:
      "Les points sont figés à la publication : un changement de barème ne modifie pas les stickers déjà collés.",
  },
  exampleTitle: "Exemple : Ushuaïa, Argentine",
  exampleIntro: "Premier sticker en Argentine, posé à 13 000 km de chez soi.",
  exampleEyebrow: "Exemple",
  exampleLabel: "Pays lointain",
  error: "Le barème n'a pas pu être chargé : voici les valeurs par défaut.",
  link: "Comment sont calculés les points ?",
} as const;
