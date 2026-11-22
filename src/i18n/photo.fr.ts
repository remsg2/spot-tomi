/** Photos des stickers : visionneuse plein écran et point de cadrage. */
const percent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const photoFr = {
  viewer: {
    open: "Voir la photo en entier",
    close: "Fermer la photo",
    title: (name: string) => `Photo du sticker « ${name} »`,
    zoomIn: "Zoomer",
    zoomOut: "Dézoomer",
    hint: "Double toucher ou pincer pour zoomer.",
  },
  focus: {
    title: "Où est ton sticker sur la photo ?",
    titleOther: "Où est le sticker sur la photo ?",
    badge: "Conseillé",
    why: "Sur la carte et dans le fil, la photo est recadrée. Touche ton sticker : il restera toujours dans le cadre.",
    whyOther: "La photo est recadrée sur la carte et dans le fil : le repère garde le sticker dans le cadre.",
    prompt: "Touche ton sticker",
    promptOther: "Touche le sticker",
    set: "Repère posé. Touche ailleurs sur la photo pour le déplacer.",
    keyboard: "Flèches pour déplacer le repère, Maj pour aller plus vite.",
    label: "Photo entière : touche le sticker pour placer le repère",
    position: (x: number, y: number) =>
      `Repère à ${percent.format(x * 100)} % depuis la gauche et ${percent.format(y * 100)} % depuis le haut.`,
    none: "Aucun repère : l'aperçu est centré sur la photo.",
    reset: "Effacer le repère",
    previewTitle: "Aperçu sur la carte",
    previewSheet: "Fiche",
    previewThumb: "Vignette",
    previewCentered: "Sans repère, la photo est centrée : le sticker peut être coupé.",
    previewFocused: "Ton sticker reste dans le cadre.",
    save: "Enregistrer le cadrage",
    saving: "Enregistrement…",
    saved: "Cadrage enregistré.",
    error: "Le cadrage n'a pas pu être enregistré. Réessaie.",
    editTitle: "Cadrage de l'aperçu",
  },
} as const;
