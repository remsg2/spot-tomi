/**
 * Empreinte perceptuelle d'une photo (dHash 64 bits) : deux photos presque identiques
 * (même cadrage, autre compression ou taille) ont des empreintes qui diffèrent de
 * quelques bits. Le serveur signale « à vérifier » un sticker dont la photo est à
 * 6 bits ou moins d'une autre (create_spot, private.similar_photo).
 *
 * Calcul : image réduite à 9 × 8 en niveaux de gris, puis 1 bit par paire de pixels
 * voisins d'une même ligne (le gauche est-il plus clair que le droit ?).
 */

export const HASH_WIDTH = 9;
export const HASH_HEIGHT = 8;

/** Luminance (0-255) de chaque pixel RGBA. */
export function grayscale(rgba: ArrayLike<number>): number[] {
  const gray: number[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    gray.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }
  return gray;
}

/** dHash d'une image 9 × 8 en niveaux de gris, en entier signé 64 bits (bigint Postgres). */
export function dHashFromGray(gray: ArrayLike<number>): bigint {
  if (gray.length !== HASH_WIDTH * HASH_HEIGHT) throw new Error("Image 9 × 8 attendue");
  let hash = BigInt(0);
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const left = gray[y * HASH_WIDTH + x];
      const right = gray[y * HASH_WIDTH + x + 1];
      hash = (hash << BigInt(1)) | (left > right ? BigInt(1) : BigInt(0));
    }
  }
  return BigInt.asIntN(64, hash);
}

/** Nombre de bits qui diffèrent entre deux empreintes. */
export function hammingDistance(a: bigint, b: bigint): number {
  let diff = BigInt.asUintN(64, a ^ b);
  let count = 0;
  while (diff > BigInt(0)) {
    count += Number(diff & BigInt(1));
    diff >>= BigInt(1);
  }
  return count;
}

/** Empreinte d'une image décodable par le navigateur, en texte ; null si impossible. */
export async function photoHash(source: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = HASH_WIDTH;
    canvas.height = HASH_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, HASH_WIDTH, HASH_HEIGHT);
    bitmap.close();
    const { data } = context.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
    return dHashFromGray(grayscale(data)).toString();
  } catch {
    return null;
  }
}
