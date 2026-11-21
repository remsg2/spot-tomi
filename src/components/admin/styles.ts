/*
 * Classes partagées par l'admin, tirées de docs/maquettes/Admin.dc.html.
 * Avertissement et danger n'existent pas encore en jetons : couleurs de la
 * maquette, en clair et en sombre (variante dark: de globals.css).
 */

export const card = "rounded-[22px] border border-line bg-card p-4";
export const cardSm = "rounded-[18px] border border-line bg-card p-3";
export const sectionTitle = "font-display text-lg font-normal leading-tight";
export const smallTitle = "font-display text-base font-normal leading-tight";

const button =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[13px] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text";

/** Valider : couleur de l'année, texte noir. */
export const buttonYear = `${button} bg-year font-bold text-on-year`;
/** Masquer, Annuler… */
export const buttonGhost = `${button} border border-line bg-transparent font-semibold text-text`;
/** Supprimer. */
export const buttonDanger = `${button} border border-line bg-transparent font-semibold text-[#B42318] dark:text-[#F87171]`;
/** Appliquer : bouton neutre inversé de la maquette. */
export const buttonStrong =
  "inline-flex min-h-[46px] items-center justify-center rounded-[12px] bg-text px-4 text-sm font-bold text-bg transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text";

export const input =
  "min-h-11 w-full rounded-[12px] border border-line bg-card px-3 text-[15px] text-text placeholder:text-muted focus:outline-3 focus:outline-offset-1 focus:outline-text";

export const warnBadge =
  "inline-flex items-center rounded-md bg-[#FDF1D3] px-1.5 py-0.5 text-[11px] font-bold text-[#7A5300] dark:bg-[#3A2E10] dark:text-[#F2C230]";
export const neutralBadge =
  "inline-flex items-center rounded-md bg-soft px-1.5 py-0.5 text-[11px] font-bold text-muted";
export const goldBadge =
  "inline-flex items-center rounded-md bg-gold px-1.5 py-0.5 text-[11px] font-bold text-band";
export const dangerBadge =
  "inline-flex items-center rounded-md bg-[#FDE4E1] px-1.5 py-0.5 text-[11px] font-bold text-[#B42318] dark:bg-[#3B1A18] dark:text-[#F87171]";

export const warnBox =
  "rounded-[18px] border border-[#F0D9A0] bg-[#FDF1D3] p-3 text-sm text-[#5C3E00] dark:border-[#5A4718] dark:bg-[#3A2E10] dark:text-[#F2C230]";

/** Retour d'une action : réussite en neutre, erreur marquée. */
export const messageOk = "rounded-[14px] border border-line bg-soft px-3 py-2 text-sm font-semibold";
export const messageError =
  "rounded-[14px] border border-[#F4B4AC] bg-[#FDE4E1] px-3 py-2 text-sm font-semibold text-[#8A1C12] dark:border-[#6B2A24] dark:bg-[#3B1A18] dark:text-[#FCA5A5]";
