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
    accountDeleted: "Ton compte a été supprimé. À bientôt !",
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
    stats: "Stats",
    feed: "Fil photo",
    profile: "Profil",
    back: "Retour",
    backToMap: "Retour à la carte",
  },
  notFound: {
    title: "Page introuvable",
    body: "Cette page n'existe pas ou a été déplacée.",
    map: "Retour à la carte",
  },
  error: {
    title: "La page n'a pas pu s'afficher",
    body: "Un problème est survenu. Réessaie dans un instant.",
    retry: "Réessayer",
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
    label: (total: number, years?: number[]) =>
      `Groupe de ${total} sticker${total > 1 ? "s" : ""}${years && years.length > 0 ? ` (${years.join(", ")})` : ""}`,
  },
  album: {
    toConquer: (points: number) => `+${points} et plus`,
  },
  sticker: {
    title: "TOMI",
    alt: "Sticker de Tomi le chat",
  },
  auth: {
    loginTitle: "Connexion",
    loginIntro: "Connecte-toi pour coller des stickers et marquer des points.",
    google: "Continuer avec Google",
    apple: "Continuer avec Apple",
    or: "ou",
    email: "Adresse email",
    emailPlaceholder: "toi@exemple.fr",
    sendCode: "Recevoir un code par email",
    codeSent: (email: string) =>
      `C'est parti : un code à 6 chiffres vient d'être envoyé à ${email}. Tape-le ici (pense à regarder dans les spams).`,
    code: "Code reçu par email",
    codeHint: "6 chiffres, valable 1 heure",
    codeInvalid: "Le code fait 6 chiffres.",
    verifyCode: "Valider le code",
    resendCode: "Renvoyer un code",
    changeEmail: "Changer d'adresse",
    usePassword: "Utiliser un mot de passe",
    useCode: "Recevoir un code par email",
    password: "Mot de passe",
    passwordHint: "8 caractères minimum",
    signIn: "Se connecter",
    signUp: "Créer un compte",
    signUpSent: (email: string) =>
      `Compte créé. Confirme ton adresse avec le lien envoyé à ${email}.`,
    forgotPassword:
      "Mot de passe oublié ? Reçois un code par email pour te connecter, puis change ton mot de passe dans tes réglages.",
    signOut: "Se déconnecter",
    loginCta: "Se connecter",
    myProfile: "Mon profil",
    pending: "Un instant…",
    callbackError:
      "La connexion n'a pas abouti. Le lien a peut-être expiré, ou il a été ouvert dans un autre navigateur que celui où tu l'as demandé : réessaie.",
    errors: {
      invalid_credentials: "Email ou mot de passe incorrect.",
      email_not_confirmed: "Confirme d'abord ton adresse avec le lien reçu par email.",
      user_already_exists: "Un compte existe déjà avec cet email : connecte-toi.",
      weak_password: "Mot de passe trop faible : 8 caractères minimum.",
      over_email_send_rate_limit:
        "L'envoi d'emails est limité pour le moment. Connecte-toi, ou crée ton compte, avec un mot de passe : aucun email n'est nécessaire.",
      over_request_rate_limit: "Trop de tentatives. Réessaie dans quelques minutes.",
      email_address_invalid: "Cette adresse email n'est pas valide.",
      otp_expired: "Code incorrect ou expiré. Vérifie-le, ou demande un nouveau code.",
      signup_disabled: "Les inscriptions sont fermées pour le moment.",
      default: "Une erreur est survenue. Réessaie.",
    },
  },
  profile: {
    username: "Pseudo",
    usernameHint: "3 à 20 caractères : lettres, chiffres ou _",
    usernameInvalid: "3 à 20 caractères : lettres sans accents, chiffres ou _.",
    usernameTaken: "Ce pseudo est déjà pris.",
    usernameReserved: "Ce pseudo est réservé : choisis-en un autre.",
    usernameAvailable: "Disponible",
    avatar: "Avatar",
    avatarOptional: "Avatar (facultatif)",
    avatarChoose: "Choisir une photo",
    avatarRemove: "Retirer l'avatar",
    avatarTooBig: "Image trop lourde (20 Mo maximum).",
    avatarInvalid: "Ce fichier n'est pas une image.",
    since: (year: number) => `Depuis ${year}`,
    roleAdmin: "Admin",
    roleModerator: "Modo",
  },
  welcome: {
    title: "Bienvenue !",
    intro: "Choisis ton pseudo : c'est lui qui apparaîtra sur la carte et au classement.",
    submit: "C'est parti",
  },
  settings: {
    title: "Réglages",
    save: "Enregistrer",
    saved: "Enregistré",
    theme: "Thème",
    vibrations: "Vibrations",
    vibrationsIntro: "De petites vibrations quand tu touches un sticker, changes un filtre ou colles un sticker.",
    vibrationsIos:
      "Sur iPhone, Safari ne laisse pas un site faire vibrer le téléphone : un léger tic se fait sentir sur les filtres, « Coller le sticker », « Me localiser » et cet interrupteur. « Retour haptique système » doit être activé dans Réglages iPhone › Sons et vibrations.",
    vibrationsToggle: "Vibrations",
    password: "Mot de passe",
    passwordIntro: "Définis ou change ton mot de passe pour te connecter sans lien par email.",
    passwordSave: "Changer le mot de passe",
    passwordSaved: "Mot de passe mis à jour.",
    deleteTitle: "Supprimer mon compte",
    deleteIntro:
      "Ton profil, tes photos et tous tes stickers seront supprimés définitivement, avec leurs points.",
    deleteConfirm: (username: string) => `Pour confirmer, tape ton pseudo : ${username}`,
    deleteButton: "Supprimer définitivement",
    deleting: "Suppression…",
    deleteError: "La suppression a échoué. Réessaie ou contacte un admin.",
    back: "Retour au profil",
  },
  legal: {
    label: "Informations légales",
    privacy: "Confidentialité",
    terms: "Conditions d'utilisation",
    moderation: "Règles et modération",
  },
  me: {
    settings: "Réglages",
    comingSoon: "Ton score, ton album et tes stickers arrivent bientôt ici.",
  },
  env: {
    staging: "Environnement de test",
    local: "Local",
    misconfigured: "Configuration Supabase manquante",
  },
} as const;

export type Messages = typeof fr;
export const t = fr;
