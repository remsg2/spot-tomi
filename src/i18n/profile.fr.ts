/**
 * Textes du profil et de l'album (étape 7), regroupés pour une traduction future.
 * Formulaires du profil (pseudo, avatar, domicile) : voir src/i18n/fr.ts (étape 3).
 */
import { ordinalFr } from "./leaderboard.fr";

export const profileFr = {
  metaMe: "Mon profil",
  metaUser: (username: string) => `Profil de ${username}`,
  avatarAlt: (username: string) => `Avatar de ${username}`,
  since: (year: number) => `Depuis ${year}`,
  roleAdmin: "Admin",
  roleModerator: "Modo",
  settings: "Réglages",
  scoreTotal: "Score total",
  rankBadge: (rank: number) => `${ordinalFr(rank)} au classement`,
  unranked: "Pas encore classé",
  stats: {
    label: "Statistiques",
    stickers: (count: number) => (count <= 1 ? "sticker" : "stickers"),
    countries: () => "pays",
    firsts: (count: number) => (count <= 1 ? "premier du pays" : "premiers du pays"),
  },
  album: {
    title: "Album",
    legend: "Années",
    /** Ex. « Argentine, conquise en 2027 : 195 points, premier du pays ». */
    conqueredLabel: (country: string, points: string, year: number, gold: boolean) =>
      `${country}, conquis en ${year} : ${points} points${gold ? ", premier du pays" : ""}`,
    lockedLabel: (country: string, points: number) =>
      `${country}, à conquérir : ${points} points de base et plus`,
    emptyMe: "Ton album est vide : colle ton premier sticker pour conquérir un pays.",
    emptyOther: "Aucun pays conquis pour l'instant.",
    toConquer: "À conquérir",
  },
  spots: {
    titleMe: "Mes stickers",
    titleOther: "Ses stickers",
    filterLabel: "Filtrer par année",
    all: "Tous",
    emptyMe: "Tu n'as encore collé aucun sticker.",
    emptyOther: "Aucun sticker publié pour l'instant.",
    emptyYear: (year: number) => `Aucun sticker en ${year}.`,
    pending: "En attente",
    pendingHint: "Points en attente de validation",
    hidden: "Masqué",
    hiddenHint: "Masqué par la modération",
    first: "Premier du pays",
    exceptional: "Lieu exceptionnel",
    count: (count: number) => (count <= 1 ? `${count} sticker` : `${count} stickers`),
  },
  notFound: {
    title: "Profil introuvable",
    body: "Aucun membre ne porte ce pseudo. Il a peut-être changé ou supprimé son compte.",
    leaderboard: "Voir le classement",
    map: "Retour à la carte",
  },
  loading: "Chargement du profil…",
  error: "Le profil n'a pas pu être chargé. Réessaie dans un instant.",
} as const;
