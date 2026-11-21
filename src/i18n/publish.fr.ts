/**
 * Textes du parcours « Nouveau sticker » (/spots/new) et de l'écran
 * « Sticker collé » (spécifications 2.2). Aucun texte en dur dans
 * src/components/publish.
 */

const decimals = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const meters = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** 1 → « 1er », 2 → « 2ᵉ ». */
export function ordinal(rank: number): string {
  return rank === 1 ? "1er" : `${rank}ᵉ`;
}

/** { lat: -54.8, lng: -68.3 } → « 54,80° S, 68,30° O ». */
export function formatCoordinates(lat: number, lng: number): string {
  const ns = lat < 0 ? "S" : "N";
  const eo = lng < 0 ? "O" : "E";
  return `${decimals.format(Math.abs(lat))}° ${ns}, ${decimals.format(Math.abs(lng))}° ${eo}`;
}

/** Heure de l'appareil « 2027-03-14T16:42:00 » → « 14 mars 2027 à 16:42 ». */
export function formatTakenAt(local: string): string {
  const date = new Date(`${local}Z`);
  return Number.isNaN(date.getTime()) ? local : dateTime.format(date);
}

export const publishFr = {
  metaTitle: "Ajouter un sticker",
  title: "Nouveau sticker",
  close: "Fermer et revenir à la carte",
  stepCount: (step: number, total: number) => `${step} / ${total}`,
  progress: (step: number, total: number) => `Étape ${step} sur ${total}`,
  loading: "Chargement…",

  photo: {
    heading: "Ta photo du sticker",
    intro:
      "Prends le sticker collé en photo, avec le lieu autour. La position et la date de la photo serviront à le placer sur la carte.",
    take: "Prendre une photo",
    choose: "Choisir une photo",
    drop: "Ou dépose ta photo ici",
    dropActive: "Lâche la photo pour l'ajouter",
    formats: "JPEG, HEIC ou PNG · 20 Mo maximum",
    reading: "Lecture de la photo…",
    converting: "Conversion de la photo HEIC…",
    errors: {
      too_big: "Photo trop lourde : 20 Mo maximum.",
      unsupported: "Format non pris en charge : choisis une photo JPEG, HEIC ou PNG.",
      empty: "Ce fichier est vide.",
      decode: "Impossible d'ouvrir cette photo. Essaie avec une autre.",
    },
  },

  review: {
    photoAlt: "Ta photo du sticker",
    changePhoto: "Changer la photo",
    checksLabel: "Vérification de la photo",
    gpsLabel: "Position GPS de la photo",
    gpsValue: (country: string | null, coords: string) => (country ? `${country} · ${coords}` : coords),
    gpsMoved: (distance: number) => `déplacée de ${meters.format(distance)} m`,
    adjust: "Ajuster",
    manualLabel: "Position du sticker",
    manualMissing: "Pas de GPS dans la photo : place-le sur la carte",
    manualValue: (country: string | null, coords: string) =>
      `${country ? `${country} · ` : ""}${coords} · placée à la main`,
    place: "Placer",
    move: "Déplacer",
    dateLabel: "Date de prise",
    dateMissing: "Absente de la photo : date d'envoi",
    yearLabel: "Sticker de l'année",
    yearFromDate: (year: number) => `${year}, d'après la date`,
    yearFromUpload: (year: number) => `${year}, année de l'envoi`,
    missing: "À vérifier",
    privacy: "Les données de la photo sont retirées avant publication.",
    pendingNotice:
      "Sans position GPS ou sans date dans la photo, un modérateur vérifie le sticker avant de compter ses points.",
    nameLabel: "Nom du lieu",
    namePlaceholder: "Ex. Panneau du bout du monde",
    nameCount: (count: number, max: number) => `${count} / ${max}`,
    estimate: "Estimation",
    estimateLoading: "Calcul…",
    estimateUnavailable: "Estimation indisponible pour l'instant",
    estimateWaiting: "Place le sticker pour voir l'estimation",
    estimatePending: "Points en attente de validation",
    estimateLabel: (points: string) => `Estimation : environ ${points} points`,
    firstInCountry: "Premier du pays",
    approx: "≈",
    submit: "Coller le sticker",
    errors: {
      name_required: "Donne un nom au lieu.",
      name_too_long: "80 caractères maximum.",
      position_required: "Place le sticker sur la carte.",
    },
  },

  picker: {
    titleAdjust: "Ajuster la position",
    titlePlace: "Placer le sticker",
    hintAdjust: (radius: number) =>
      `Fais glisser la carte : le sticker est sous le repère. ${meters.format(radius)} m maximum autour de la position de la photo.`,
    hintPlace: "Fais glisser la carte pour mettre le repère à l'endroit exact du sticker.",
    confirm: "Valider la position",
    placeHere: "Placer le sticker ici",
    zoomIn: "Zoome jusqu'à la rue pour placer le sticker précisément.",
    reset: "Position de la photo",
    myLocation: "Ma position",
    locating: "Localisation…",
    locationDenied: "Position indisponible : déplace la carte à la main.",
    distance: (distance: number, radius: number) =>
      `${meters.format(distance)} m / ${meters.format(radius)} m de la position de la photo`,
    mapLabel: "Carte du lieu du sticker. Flèches du clavier pour la déplacer, + et − pour zoomer.",
    marker: "Repère : position du sticker",
    back: "Retour à la vérification",
    mapUnavailable: "Carte indisponible : le fond de carte n'a pas pu être chargé.",
    /** Libellés des contrôles MapLibre (option `locale`). */
    mapLocale: {
      "AttributionControl.ToggleAttribution": "Afficher ou masquer les crédits",
      "AttributionControl.MapFeedback": "Signaler une erreur de carte",
      "Map.Title": "Carte",
      "NavigationControl.ResetBearing": "Remettre le nord en haut",
      "NavigationControl.ZoomIn": "Zoomer",
      "NavigationControl.ZoomOut": "Dézoomer",
      "LogoControl.Title": "Logo MapLibre",
    },
  },

  publishing: {
    title: "Publication du sticker",
    encode: "Nettoyage de la photo (données retirées)",
    upload: "Envoi de la photo",
    score: "Calcul des points",
    done: "Terminé",
    retry: "Réessayer",
    back: "Revenir à la vérification",
  },

  done: {
    title: "Sticker collé !",
    place: (city: string | null, country: string | null, name: string) =>
      [city, country].filter(Boolean).join(", ") || name,
    stickerLabel: (band: string) => `Sticker de Tomi : ${band}`,
    pendingBand: "En attente",
    pendingNotice: "Tes points compteront dès qu'un modérateur aura validé le sticker.",
    rankUp: (rank: number) => `Tu passes ${ordinal(rank)} du classement`,
    rankEnter: (rank: number) => `Tu entres au classement : ${ordinal(rank)}`,
    pointsLabel: "Détail des points",
    seeOnMap: "Voir sur la carte",
    share: "Partager",
    shareCopied: "Lien copié",
    shareTitle: (name: string) => `${name} · Spot Tomi`,
    another: "Coller un autre",
  },

  /** Erreurs de publication, par code (contrat publish-spot). */
  errors: {
    unauthorized: "Ta session a expiré : reconnecte-toi puis réessaie.",
    method_not_allowed: "Requête refusée.",
    invalid_input: "Les informations du sticker sont incomplètes ou invalides.",
    photo_missing: "La photo n'a pas été retrouvée : réessaie.",
    photo_invalid: "La photo préparée n'est pas valide : réessaie avec une autre photo.",
    photo_metadata:
      "La photo contenait encore des données (EXIF, XMP ou ICC) : elle a été supprimée par sécurité. Réessaie.",
    photo_reused: "Cette photo a déjà été publiée.",
    missing_profile: "Choisis d'abord ton pseudo pour publier un sticker.",
    suspended: "Ton compte est suspendu : tu ne peux plus publier de sticker.",
    daily_limit: "Tu as atteint la limite de 20 stickers en 24 heures. Réessaie plus tard.",
    nearby_today: "Tu as déjà collé un sticker à moins de 200 m d'ici ces dernières 24 heures.",
    server_error: "Erreur du serveur. Réessaie dans un instant.",
    network: "Connexion impossible. Vérifie ton réseau puis réessaie.",
    upload_failed: "L'envoi de la photo a échoué. Réessaie.",
    encode_failed: "Impossible de préparer la photo. Essaie avec une autre.",
    unknown: "Une erreur est survenue. Réessaie.",
  },
} as const;

export type PublishErrorKey = keyof typeof publishFr.errors;
export const tp = publishFr;
