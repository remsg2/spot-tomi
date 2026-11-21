/** Couleur d'une année sans ligne dans `seasons` (spécifications, 4.1). */
export const FALLBACK_YEAR_COLOR = "#9A9A94";
/** Texte posé sur la couleur de l'année. */
export const BAND_COLOR = "#111111";
export const GOLD_COLOR = "#E9B52F";
/** Contraste minimal du texte noir sur la couleur de l'année (WCAG AA). */
export const MIN_CONTRAST = 4.5;

const HEX = /^#([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG 2 d'une couleur #RRGGBB. */
export function relativeLuminance(hex: string): number {
  const match = HEX.exec(hex);
  if (!match) throw new Error(`Couleur invalide : ${hex}`);
  const n = Number.parseInt(match[1], 16);
  const r = channel((n >> 16) & 0xff);
  const g = channel((n >> 8) & 0xff);
  const b = channel(n & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2 entre deux couleurs (1 à 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** La couleur de l'année est-elle lisible sous du texte noir #111111 ? */
export function isReadableYearColor(hex: string): boolean {
  return isHexColor(hex) && contrastRatio(hex, BAND_COLOR) >= MIN_CONTRAST;
}
