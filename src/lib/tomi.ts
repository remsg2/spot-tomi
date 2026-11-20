/**
 * Image de Tomi : point d'entrée unique.
 * Images provisoires tirées des maquettes ; remplacer les fichiers de
 * public/tomi/ (ou les chemins ci-dessous) quand le détouré HD sera fourni.
 */
export const TOMI_IMAGE = {
  /** Tomi détouré, cadré pour le sticker carré. */
  full: { src: "/tomi/tomi.png", width: 700, height: 709 },
  /** Tomi recadré sur la tête, pour les marqueurs de la carte. */
  head: { src: "/tomi/tomi-head.png", width: 200, height: 200 },
} as const;
