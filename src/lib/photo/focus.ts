/**
 * Point du sticker sur la photo (0 à 1 depuis le coin haut-gauche) : centre l'aperçu
 * recadré partout où la photo est coupée (fiche, fil photo, miniatures).
 */
import type { PhotoFocus } from "@/lib/publish/contract";

export type { PhotoFocus };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Point lu en base (focus_x, focus_y), ou null si absent ou invalide. */
export function toFocus(x: unknown, y: unknown): PhotoFocus | null {
  if (x === null || y === null || x === undefined || y === undefined) return null;
  const fx = Number(x);
  const fy = Number(y);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  return { x: clamp01(fx), y: clamp01(fy) };
}

/**
 * `object-position` d'une image recadrée (`object-fit: cover`) : le point à x % de
 * la photo tombe à x % du cadre, donc reste toujours visible. Sans point : le centre.
 */
export function focusPosition(focus: PhotoFocus | null | undefined): string {
  if (!focus) return "50% 50%";
  return `${round3(focus.x * 100)}% ${round3(focus.y * 100)}%`;
}

/** Point touché sur l'image affichée en entier (rectangle de l'élément img). */
export function focusFromPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): PhotoFocus | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: round3(clamp01((clientX - rect.left) / rect.width)),
    y: round3(clamp01((clientY - rect.top) / rect.height)),
  };
}

const NUDGE = 0.02;

/** Flèches du clavier : déplace le point de 2 % (10 % avec Maj). Null : touche ignorée. */
export function nudgeFocus(focus: PhotoFocus | null, key: string, large = false): PhotoFocus | null {
  const step = large ? NUDGE * 5 : NUDGE;
  const start = focus ?? { x: 0.5, y: 0.5 };
  const delta: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  const move = delta[key];
  if (!move) return null;
  return { x: round3(clamp01(start.x + move[0])), y: round3(clamp01(start.y + move[1])) };
}

/** Deux points identiques (au millième près), null compris. */
export function sameFocus(a: PhotoFocus | null, b: PhotoFocus | null): boolean {
  if (!a || !b) return a === b;
  return round3(a.x) === round3(b.x) && round3(a.y) === round3(b.y);
}
