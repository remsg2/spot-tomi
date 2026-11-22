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
    title: "Où est ton sticker ?",
    titleOther: "Où est le sticker ?",
    hint: "Touche le sticker sur la photo : l'aperçu sera centré dessus.",
    set: "Sticker repéré : l'aperçu est centré dessus.",
    keyboard: "Flèches pour déplacer le repère, Maj pour aller plus vite.",
    label: "Photo entière : touche le sticker pour placer le repère",
    position: (x: number, y: number) =>
      `Repère à ${percent.format(x * 100)} % depuis la gauche et ${percent.format(y * 100)} % depuis le haut.`,
    none: "Aucun repère : l'aperçu est centré sur la photo.",
    reset: "Recentrer",
    save: "Enregistrer le cadrage",
    saving: "Enregistrement…",
    saved: "Cadrage enregistré.",
    error: "Le cadrage n'a pas pu être enregistré. Réessaie.",
    editTitle: "Cadrage de l'aperçu",
    editIntro: "Sur la carte et dans le fil, la photo est recadrée : touche ton sticker pour qu'il reste visible.",
  },
} as const;
