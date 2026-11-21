/**
 * Textes de l'onglet Stats (/stats), du fil photo (/fil) et des statistiques du profil :
 * passeport, badges, progression (cahier des charges V1.1, sections 8 et 9).
 */

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

export const statsFr = {
  title: "Stats",
  metaDescription: "Les chiffres du monde de Tomi : stickers, pays conquis, records et lieux les plus rares.",
  intro: "Les chiffres de tous les stickers publiés et non masqués.",
  error: "Les statistiques n'ont pas pu être chargées. Réessaie dans un instant.",
  unavailable: "Donnée indisponible",
  number: (n: number) => integer.format(n),
  date: (iso: string) => dateFormat.format(new Date(iso)),
  shortDate: (iso: string) => shortDate.format(new Date(iso)),
  world: {
    title: "Le monde de Tomi",
    stickers: (n: number) => (n <= 1 ? "Tomi collé" : "Tomis collés"),
    countries: "pays conquis",
    of: (n: number) => `sur ${integer.format(n)}`,
    continents: "continents",
    members: (n: number) => (n <= 1 ? "membre" : "membres"),
    contributors: (n: number) => (n <= 1 ? "a déjà collé un sticker" : "ont déjà collé un sticker"),
    editions: (n: number) => (n <= 1 ? "édition représentée" : "éditions représentées"),
    distance: "km parcourus",
    distanceHow:
      "Distance cumulée : pour chaque membre, la somme des distances entre ses stickers successifs (dans l'ordre des dates de collage), additionnée sur tous les membres.",
  },
  topCountries: "Pays les plus visités",
  recentConquests: "Pays récemment conquis",
  conquest: {
    title: "Conquête mondiale",
    progress: (done: number, total: number) => `${integer.format(done)} pays conquis sur ${integer.format(total)}`,
    virgin: (n: number) => `${integer.format(n)} pays encore vierges`,
    mapLink: "Voir la carte de conquête",
  },
  records: {
    title: "Records",
    highest: "Tomi le plus haut",
    most_isolated: "Tomi le plus isolé",
    rarest: "Tomi le plus rare",
    most_liked: "Tomi le plus aimé",
    top_traveler: "Plus grand voyageur",
    longest_distance: "Plus grand écart",
    latest_conquest: "Pays le plus récemment conquis",
    value: {
      highest: (m: number) => `${integer.format(Math.round(m))} m`,
      most_isolated: (km: number) => `${decimal.format(km)} km`,
      rarest: (bonus: number) => `+${integer.format(bonus)} pts de rareté`,
      most_liked: (n: number) => (n <= 1 ? `${n} like` : `${integer.format(n)} likes`),
      top_traveler: (points: number) => `${integer.format(points)} pts`,
      longest_distance: (km: number) => `${integer.format(km)} km`,
      latest_conquest: () => "",
    },
    metric: {
      highest: "Altitude de la photo (GPS) ou du terrain",
      most_isolated: "Distance au sticker publié le plus proche",
      rarest: "Plus gros bonus de rareté",
      most_liked: "Nombre de likes",
      top_traveler: "Le plus de points au classement",
      longest_distance: "Entre deux stickers d'un même membre",
      latest_conquest: "Premier sticker du pays le plus récent",
    },
    by: (username: string) => `par ${username}`,
  },
  continentFirsts: {
    title: "Premier Tomi de chaque continent",
    item: (country: string | null, username: string, date: string) =>
      [country, `par ${username}`, date].filter(Boolean).join(" · "),
  },
  rarest: {
    title: "Lieux les plus rares",
    seeAll: "Tout le classement des lieux rares",
    empty: "Aucun lieu rare pour l'instant.",
  },
  me: {
    title: "Mes stats",
    login: "Connecte-toi pour voir tes statistiques.",
    link: "Voir mon profil complet",
  },
  feedLink: "Fil photo : les derniers stickers",
  // Profil ----------------------------------------------------------------------
  profile: {
    statsTitle: "Statistiques",
    continents: (n: number) => (n <= 1 ? "continent" : "continents"),
    editions: "Éditions",
    editionCount: (name: string, n: number) => `${name} · ${n <= 1 ? `${n} sticker` : `${integer.format(n)} stickers`}`,
    highest: "Le plus haut",
    mostIsolated: "Le plus isolé",
    altitude: (m: number) => `${integer.format(Math.round(m))} m`,
    km: (km: number) => `${decimal.format(km)} km du plus proche`,
    byCountry: "Par pays",
    likes: (n: number) => (n <= 1 ? "like reçu" : "likes reçus"),
    progressTitle: "Progression des points",
    progressLabel: (points: string, date: string) => `${points} points le ${date}`,
    progressEmpty: "Pas encore de points.",
  },
  passport: {
    title: "Passeport",
    progress: (done: number, total: number) => `${integer.format(done)} pays sur ${integer.format(total)}`,
    stamp: (country: string, date: string, edition: string) => `${country}, premier collage le ${date}, ${edition}`,
    pioneer: "Pionnier",
    empty: "Ton passeport est vide : colle ton premier sticker pour obtenir un tampon.",
    emptyOther: "Aucun tampon pour l'instant.",
    toConquer: "À conquérir",
  },
  badges: {
    title: "Badges",
    unlocked: (n: number, total: number) => `${n} sur ${total}`,
    locked: "À débloquer",
    unlockedOn: (date: string) => `Débloqué le ${date}`,
  },
  notices: {
    title: "Avis",
    empty: "Aucun avis.",
    markRead: "Tout marquer comme lu",
    unread: (n: number) => (n <= 1 ? `${n} nouvel avis` : `${n} nouveaux avis`),
  },
  history: {
    title: "Journal de mes points",
    empty: "Aucune ligne pour l'instant.",
    total: "Total",
  },
  // Fil photo -----------------------------------------------------------------
  feed: {
    title: "Fil photo",
    metaDescription: "Les derniers stickers de Tomi collés dans le monde.",
    intro: "Les derniers stickers publiés, du plus récent au plus ancien.",
    more: "Plus de stickers",
    empty: "Aucun sticker publié pour l'instant.",
    by: (username: string) => `par ${username}`,
    error: "Le fil n'a pas pu être chargé. Réessaie dans un instant.",
  },
} as const;

export const ts = statsFr;
