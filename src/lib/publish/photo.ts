/**
 * Contrôles de la photo choisie (spécifications 2.2) : JPEG, HEIC ou PNG,
 * 20 Mo maximum. Le type est reconnu à la signature du fichier, pas à son
 * nom ni au type annoncé par le navigateur (souvent vide pour le HEIC).
 */
import { MAX_PHOTO_BYTES, MAX_PHOTO_SIDE } from "./contract";

export type PhotoKind = "jpeg" | "png" | "heic";

export const ACCEPTED_PHOTO_TYPES = "image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif";

/** Marques ISO-BMFF des images HEIF/HEIC (boîte ftyp). */
const HEIF_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs", "mif1", "msf1"]);

export function detectPhotoKind(head: Uint8Array): PhotoKind | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg";
  if (
    head.length >= 8 &&
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "png";
  }
  if (head.length >= 12 && String.fromCharCode(...head.slice(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...head.slice(8, 12));
    if (HEIF_BRANDS.has(brand)) return "heic";
  }
  return null;
}

export type PhotoCheck = { ok: true; kind: PhotoKind } | { ok: false; reason: "too_big" | "unsupported" | "empty" };

/** Vérifie la taille et le format d'une photo à partir de ses premiers octets. */
export function checkPhoto(size: number, head: Uint8Array): PhotoCheck {
  if (size === 0) return { ok: false, reason: "empty" };
  if (size > MAX_PHOTO_BYTES) return { ok: false, reason: "too_big" };
  const kind = detectPhotoKind(head);
  return kind ? { ok: true, kind } : { ok: false, reason: "unsupported" };
}

/** Dimensions après réduction : le plus grand côté à `max` pixels, jamais d'agrandissement. */
export function targetSize(width: number, height: number, max: number = MAX_PHOTO_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new Error("Dimensions d'image invalides");
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
