/**
 * Pages légales (cahier des charges 16) : BROUILLONS à faire relire avant l'ouverture au
 * public. Les passages entre crochets sont à compléter par le porteur du projet.
 */

export type LegalPage = {
  title: string;
  description: string;
  updated: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
};

const DRAFT_NOTICE =
  "Brouillon : ce texte doit être relu (idéalement par un juriste) et complété avant l'ouverture au public.";

export const legalFr = {
  draft: DRAFT_NOTICE,
  back: "Retour",
  updated: (date: string) => `Dernière mise à jour : ${date}`,
  privacy: {
    title: "Politique de confidentialité",
    description: "Quelles données Spot Tomi collecte, pourquoi, combien de temps, et comment exercer tes droits.",
    updated: "21 novembre 2026",
    sections: [
      {
        title: "Responsable du traitement",
        paragraphs: [
          "Spot Tomi est édité par [nom de l'éditeur, statut, adresse]. Contact pour toute question sur tes données : [adresse email de contact].",
        ],
      },
      {
        title: "Données collectées",
        paragraphs: [
          "Compte : adresse email (jamais affichée publiquement), pseudo public, photo de profil facultative, préférence de thème.",
          "Stickers : photo (réencodée dans ton navigateur, sans aucune métadonnée EXIF, GPS ou appareil), position exacte du sticker, date du collage, édition, nom du lieu, commentaire facultatif, ville et pays déduits de la position, altitude.",
          "Activité : points, badges, likes, signalements, avis de modération et journal des actions des modérateurs.",
          "Technique : journal des erreurs de l'app (message, page, navigateur), gardé 30 jours.",
        ],
      },
      {
        title: "Ce qui est public",
        paragraphs: [
          "La localisation d'un collage est publique par nature : la photo, la position exacte, la date, l'édition, le nom du lieu, le commentaire et ton pseudo sont visibles par tous sur la carte. L'app le rappelle avant chaque publication. Ne publie pas un sticker collé chez toi ou dans un lieu que tu ne veux pas révéler.",
          "Ton profil public montre ton pseudo, ta date d'inscription, tes stickers publiés, tes points, ton rang, tes pays, ton passeport et tes badges.",
        ],
      },
      {
        title: "Finalités et base légale",
        paragraphs: [
          "Faire fonctionner le service que tu as demandé en créant un compte (exécution du contrat) : carte, points, classements, statistiques.",
          "Assurer la sécurité et la modération (intérêt légitime) : signalements, journal de modération, détection des doublons et des photos très proches, journal d'erreurs.",
        ],
      },
      {
        title: "Sous-traitants et services externes",
        paragraphs: [
          "Hébergement de l'app : Vercel (fonctions en région Paris ; société américaine). Base de données, authentification et fichiers : Supabase ([région du projet]).",
          "À la publication, les coordonnées du sticker (jamais ton identité) sont envoyées à Photon (komoot, Allemagne) pour trouver la ville, et à Open-Meteo (Suisse) pour l'altitude si la photo n'en a pas. Les fonds de carte viennent d'OpenFreeMap (données OpenStreetMap).",
          "[Préciser les garanties des transferts hors de l'Union européenne.]",
        ],
      },
      {
        title: "Durées de conservation",
        paragraphs: [
          "Tes données sont gardées tant que ton compte existe. Un sticker supprimé disparaît avec sa photo ; le journal de points garde une ligne chiffrée sans photo ni position.",
          "Le journal d'erreurs est effacé au bout de 30 jours. Les sauvegardes chiffrées de la base sont gardées 30 jours : une donnée supprimée en disparaît au plus tard 30 jours après.",
        ],
      },
      {
        title: "Cookies et stockage local",
        paragraphs: [
          "Seuls des cookies nécessaires à la connexion sont utilisés. Tes préférences (thème, vibrations) restent sur ton appareil. Aucune mesure d'audience ni publicité.",
        ],
      },
      {
        title: "Tes droits",
        paragraphs: [
          "Tu peux modifier ton pseudo et ta photo, corriger ou supprimer tes stickers, et supprimer ton compte à tout moment depuis tes réglages : profil, photos, stickers et points sont alors effacés.",
          "Pour accéder à tes données, en obtenir une copie, t'opposer à un traitement ou poser une question : [adresse email de contact]. Tu peux aussi saisir la CNIL (cnil.fr).",
        ],
      },
    ],
  } satisfies LegalPage,
  terms: {
    title: "Conditions d'utilisation",
    description: "Les règles d'usage de Spot Tomi.",
    updated: "21 novembre 2026",
    sections: [
      {
        title: "Le service",
        paragraphs: [
          "Spot Tomi recense les lieux du monde où des stickers de Tomi ont été collés. La carte est consultable par tous ; ajouter, modifier, aimer ou signaler un sticker demande un compte.",
        ],
      },
      {
        title: "Ton compte",
        paragraphs: [
          "Tu choisis un pseudo unique, qui ne doit pas usurper l'identité de quelqu'un ni d'un rôle de l'équipe. Tu es responsable de ce qui est publié depuis ton compte.",
        ],
      },
      {
        title: "Tes publications",
        paragraphs: [
          "Tu publies uniquement des photos que tu as prises, d'un sticker de Tomi réellement collé à l'endroit indiqué. Tu accordes à Spot Tomi le droit de les afficher dans l'app (carte, fiche, fil photo, statistiques) tant qu'elles y sont publiées.",
          "Pas de visage reconnaissable sans accord, de plaque d'immatriculation lisible, de donnée personnelle ou de contenu choquant.",
        ],
      },
      {
        title: "Respect des lieux et des lois",
        paragraphs: [
          "Ne colle jamais sur un monument, une œuvre, un site naturel protégé, un transport ou une propriété privée sans autorisation. Aucun bonus ne justifie une intrusion, une dégradation ou une mise en danger. Tu restes seul responsable de tes collages.",
        ],
      },
      {
        title: "Points et classement",
        paragraphs: [
          "Les points sont calculés par le serveur selon le barème publié sur la page « Comment gagner des points ». L'équipe peut corriger des points, masquer ou supprimer un sticker en cas de triche ou de non-respect des règles ; chaque correction est inscrite au journal de points avec son motif.",
        ],
      },
      {
        title: "Suspension et suppression",
        paragraphs: [
          "En cas de manquement grave ou répété, un compte peut être suspendu ou supprimé. Tu peux supprimer ton compte à tout moment depuis tes réglages.",
        ],
      },
      {
        title: "Contact",
        paragraphs: ["[Nom de l'éditeur, adresse et email de contact.]"],
      },
    ],
  } satisfies LegalPage,
  moderation: {
    title: "Règles et modération",
    description: "Comment Spot Tomi est modéré, et comment signaler un sticker.",
    updated: "21 novembre 2026",
    sections: [
      {
        title: "Publication directe",
        paragraphs: [
          "Un sticker est visible dès sa publication. La modération intervient ensuite : signalements, contrôles automatiques (doublons à moins de 200 m, photos très proches d'une autre, position placée à la main) et vérification par l'équipe.",
        ],
      },
      {
        title: "Règles de conduite",
        paragraphs: [
          "Respecte les lois et les lieux : jamais sur un monument, une œuvre, un site naturel protégé, un transport ou une propriété privée sans autorisation.",
          "Une photo par sticker réellement collé, à l'endroit indiqué. Pas de fausse position, de photo reprise d'un autre membre ou de contenu choquant.",
        ],
      },
      {
        title: "Signaler un sticker",
        paragraphs: [
          "Sur chaque fiche, le bouton « Signaler » envoie le sticker aux modérateurs, avec une raison facultative. À partir de 3 signalements, le sticker est retiré de la carte le temps de l'examen.",
        ],
      },
      {
        title: "Décisions",
        paragraphs: [
          "Chaque signalement est traité : retenu (sticker masqué ou supprimé) ou rejeté (sticker gardé). L'auteur du sticker et les auteurs des signalements reçoivent un avis sur leur profil. Toutes les décisions sont inscrites au journal de modération.",
          "Un sticker masqué peut être rétabli. Les points retirés à la suite d'une suppression ou d'une fraude sont tracés dans le journal de points.",
        ],
      },
      {
        title: "Contester une décision",
        paragraphs: ["Écris à [adresse email de contact] en indiquant le lien du sticker."],
      },
    ],
  } satisfies LegalPage,
} as const;
