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
    label: (total: number, groups: { count: number; year?: number }[]) => {
      const years = groups.every((group) => group.year !== undefined)
        ? ` : ${groups.map((group) => `${group.count} en ${group.year}`).join(", ")}`
        : "";
      return `Groupe de ${total} sticker${total > 1 ? "s" : ""}${years}`;
    },
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
    sendMagicLink: "Recevoir un lien de connexion",
    magicLinkSent: (email: string) =>
      `C'est parti : un lien de connexion vient d'être envoyé à ${email}. Ouvre-le sur cet appareil.`,
    usePassword: "Utiliser un mot de passe",
    useMagicLink: "Utiliser un lien par email",
    password: "Mot de passe",
    passwordHint: "8 caractères minimum",
    signIn: "Se connecter",
    signUp: "Créer un compte",
    signUpSent: (email: string) =>
      `Compte créé. Confirme ton adresse avec le lien envoyé à ${email}.`,
    forgotPassword: "Mot de passe oublié ? Reçois un lien de connexion, puis change-le dans tes réglages.",
    signOut: "Se déconnecter",
    loginCta: "Se connecter",
    myProfile: "Mon profil",
    pending: "Un instant…",
    callbackError: "La connexion n'a pas abouti. Le lien a peut-être expiré : réessaie.",
    errors: {
      invalid_credentials: "Email ou mot de passe incorrect.",
      email_not_confirmed: "Confirme d'abord ton adresse avec le lien reçu par email.",
      user_already_exists: "Un compte existe déjà avec cet email : connecte-toi.",
      weak_password: "Mot de passe trop faible : 8 caractères minimum.",
      over_email_send_rate_limit: "Trop d'emails envoyés. Réessaie dans quelques minutes.",
      over_request_rate_limit: "Trop de tentatives. Réessaie dans quelques minutes.",
      email_address_invalid: "Cette adresse email n'est pas valide.",
      signup_disabled: "Les inscriptions sont fermées pour le moment.",
      default: "Une erreur est survenue. Réessaie.",
    },
  },
  profile: {
    username: "Pseudo",
    usernameHint: "3 à 20 caractères : lettres, chiffres ou _",
    usernameInvalid: "3 à 20 caractères : lettres sans accents, chiffres ou _.",
    usernameTaken: "Ce pseudo est déjà pris.",
    usernameAvailable: "Disponible",
    avatar: "Avatar",
    avatarOptional: "Avatar (facultatif)",
    avatarChoose: "Choisir une photo",
    avatarRemove: "Retirer l'avatar",
    avatarTooBig: "Image trop lourde (20 Mo maximum).",
    avatarInvalid: "Ce fichier n'est pas une image.",
    home: "Domicile",
    homeOptional: "Domicile (facultatif)",
    homeExplain:
      "Il sert à calculer le bonus « loin de chez toi » et à flouter tes stickers posés près de chez toi. Il est arrondi à environ 1 km et n'est jamais affiché.",
    homeUseLocation: "Utiliser ma position actuelle",
    homeLocating: "Localisation…",
    homeSet: "Domicile enregistré (arrondi à ~1 km)",
    homeReady: "Position trouvée : elle sera arrondie à ~1 km.",
    homeNone: "Aucun domicile enregistré",
    homeRemove: "Retirer mon domicile",
    homeDenied: "Position refusée ou indisponible. Tu pourras l'ajouter plus tard dans tes réglages.",
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
