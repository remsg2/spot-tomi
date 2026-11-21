/**
 * Textes de la carte, de la fiche lieu, du gabarit d'application et de la PWA
 * (étape 6), regroupés pour une traduction future.
 */
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
const shortDateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });
const integer = new Intl.NumberFormat("fr-FR");

function plural(count: number, one: string, many: string) {
  return `${integer.format(count)} ${count > 1 ? many : one}`;
}

export const mapFr = {
  shell: {
    column: "Panneau",
    addSticker: "Ajouter un sticker",
    admin: "Admin",
    login: "Se connecter",
    myProfile: "Mon profil",
    scoreUnknown: "Mon profil : score pas encore calculé",
    loadingAccount: "Chargement du compte",
  },
  map: {
    title: "Carte des stickers",
    region: "Carte du monde des stickers",
    loading: "Chargement de la carte…",
    noWebgl: "Ton navigateur ne peut pas afficher la carte (WebGL indisponible).",
    dataUnavailable: "Les stickers ne peuvent pas être chargés pour le moment.",
    offlineTiles: "Fond de carte simplifié (tuiles injoignables)",
    truncated: "Beaucoup de stickers ici : zoome pour tous les voir.",
    zoomIn: "Zoomer",
    zoomOut: "Dézoomer",
    locate: "Me localiser",
    locating: "Localisation…",
    locateDenied: "Position refusée ou indisponible.",
    locateUnsupported: "La localisation n'est pas disponible sur cet appareil.",
    attribution: "© OpenStreetMap",
    attributionTiles: "OpenFreeMap",
    onScreen: (count: number) => `${plural(count, "sticker", "stickers")} à l'écran`,
    legend: {
      title: "Légende",
      small: "-20",
      medium: "20-79",
      large: "80+ pts",
      gold: "Premier du pays ou lieu exceptionnel",
      group: "Groupe : années présentes et nombre de stickers",
    },
  },
  filters: {
    label: "Filtres",
    open: "Filtres",
    title: "Filtrer les stickers",
    years: "Année",
    year: (year: number) => `Année ${year}`,
    rare: "Rares",
    rareHint: "Anneau doré ou pays à 60 points et plus",
    mine: "Mes stickers",
    mineLogin: "Connecte-toi pour voir tes stickers",
    person: "Personne",
    everyone: "Toutes les personnes",
    personPlaceholder: "Un pseudo",
    personOf: (username: string) => `@${username}`,
    clearPerson: (username: string) => `Retirer le filtre @${username}`,
    reset: "Tout effacer",
    apply: "Voir les stickers",
    close: "Fermer",
    active: (count: number) => `Filtres (${count} actif${count > 1 ? "s" : ""})`,
  },
  search: {
    label: "Rechercher",
    placeholder: "Un lieu, un pays, une personne",
    places: "Lieux",
    countries: "Pays",
    people: "Personnes",
    empty: "Aucun résultat",
    searching: "Recherche…",
    countryDetail: (count: number) => (count > 0 ? plural(count, "sticker", "stickers") : "Aucun sticker"),
    personDetail: (count: number) => plural(count, "sticker", "stickers"),
    results: (count: number) => plural(count, "résultat", "résultats"),
  },
  summary: {
    open: (name: string) => `Ouvrir la fiche de ${name}`,
    close: "Fermer",
    by: (username: string) => `par ${username}`,
    loading: "Chargement…",
  },
  list: {
    title: "À l'écran",
    empty: "Aucun sticker dans cette zone. Déplace la carte ou change les filtres.",
    loading: "Chargement des stickers…",
    more: (count: number) => `et ${plural(count, "autre", "autres")}`,
  },
  drawer: {
    expand: "Agrandir la fiche",
    collapse: "Réduire la fiche",
  },
  spot: {
    back: "Retour à la carte",
    close: "Fermer la fiche",
    share: "Partager",
    shareText: (name: string) => `${name} · un sticker de Tomi sur Spot Tomi`,
    linkCopied: "Lien copié",
    shareFailed: "Impossible de partager ce lien.",
    photoAlt: (name: string) => `Photo du sticker collé à ${name}`,
    noPhoto: "Photo indisponible",
    by: (username: string) => `par ${username}`,
    date: (iso: string) => dateFormat.format(new Date(iso)),
    shortDate: (iso: string) => shortDateFormat.format(new Date(iso)),
    place: (city: string | null, country: string | null) =>
      [city, country].filter(Boolean).join(", "),
    rarity: "Rareté",
    tier: {
      courant: "Pays courant",
      lointain: "Pays lointain",
      rare: "Pays rare",
      extreme: "Pays extrême",
    } as Record<string, string>,
    tierFirst: (tier: string) => `${tier}, premier sticker`,
    badges: {
      firstInCountry: "Premier sticker du pays",
      exceptional: "Lieu exceptionnel",
      pending: "En attente de validation",
    },
    altitude: (meters: number) => `${integer.format(Math.round(meters))} m`,
    pendingNote: "Points en attente : un modérateur doit valider ce sticker (photo sans position ou sans date).",
    noLines: "Le détail des points n'est pas disponible.",
    notFoundTitle: "Sticker introuvable",
    notFound: "Ce sticker n'existe pas ou n'est plus visible.",
    backHome: "Retour à la carte",
    metaDescription: (place: string, username: string, points: string) =>
      `${place ? `${place} · ` : ""}par ${username} · ${points} pts`,
    author: {
      title: "C'est ton sticker",
      rename: "Renommer",
      renameLabel: "Nom du lieu",
      renameSave: "Enregistrer",
      renameCancel: "Annuler",
      renamed: "Nom enregistré.",
      delete: "Supprimer",
      deleteConfirm: "Supprimer ce sticker, sa photo et ses points ? C'est définitif.",
      deleteYes: "Supprimer définitivement",
      deleteNo: "Garder",
      deleting: "Suppression…",
    },
    report: {
      button: "Signaler",
      title: "Signaler ce sticker",
      reason: "Raison (facultatif)",
      reasonPlaceholder: "Photo inappropriée, faux lieu…",
      submit: "Envoyer le signalement",
      cancel: "Annuler",
      sent: "Merci, le signalement a été envoyé aux modérateurs.",
      already: "Tu as déjà signalé ce sticker.",
      login: "Connecte-toi pour signaler",
    },
    errors: {
      nameInvalid: "Le nom doit faire entre 1 et 80 caractères.",
      loginRequired: "Connecte-toi d'abord.",
      notAllowed: "Tu ne peux pas modifier ce sticker.",
      suspended: "Ton compte est suspendu.",
      limit: "Trop de signalements aujourd'hui. Réessaie demain.",
      generic: "Une erreur est survenue. Réessaie.",
    },
  },
  pwa: {
    offlineTitle: "Hors ligne",
    offline: "Pas de réseau pour le moment. La carte et les fiches déjà consultées restent disponibles ; le reste reviendra avec la connexion.",
    retry: "Réessayer",
  },
} as const;

export type MapMessages = typeof mapFr;
export const tm = mapFr;
