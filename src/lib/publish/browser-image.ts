/**
 * Traitement de la photo dans le navigateur (spécifications 2.2, 2.7, 6.1).
 *
 * 1. preparePhoto : contrôle du format, lecture EXIF sur le fichier
 *    d'origine (avant tout envoi), conversion HEIC si le navigateur ne sait
 *    pas l'afficher (heic-to, chargé à la demande).
 * 2. reencodeToWebp : redessin sur un canvas (2048 px maximum) puis
 *    encodage WebP. Le canvas ne contient que des pixels : EXIF, GPS, XMP et
 *    profil ICC disparaissent. Sans encodeur WebP natif (Safari renvoie du
 *    PNG), libwebp en WebAssembly prend le relais, chargé à la demande.
 *    Le profil ICC sRVB que Chromium ajoute est retiré, puis le résultat est
 *    contrôlé chunk par chunk avant l'envoi.
 */
import { inspectWebp, MAX_PHOTO_SIDE, stripWebpMetadata } from "./contract";
import { readPhotoMetadata, type PhotoMetadata } from "./exif";
import { checkPhoto, targetSize, type PhotoKind } from "./photo";

export type PhotoErrorReason = "too_big" | "unsupported" | "empty" | "decode";

export class PhotoError extends Error {
  constructor(readonly reason: PhotoErrorReason | "encode" | "metadata") {
    super(`Photo : ${reason}`);
    this.name = "PhotoError";
  }
}

export type PreparedPhoto = {
  file: File;
  kind: PhotoKind;
  /** Image affichable par le navigateur (la photo, ou sa conversion JPEG). */
  decodable: Blob;
  previewUrl: string;
  width: number;
  height: number;
  meta: PhotoMetadata;
};

/** Décode une image ; l'orientation EXIF est appliquée par le navigateur. */
export function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(image);
      else reject(new PhotoError("decode"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new PhotoError("decode"));
    };
    image.src = url;
  });
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to/next");
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
}

export async function preparePhoto(
  file: File,
  onPhase?: (phase: "reading" | "converting") => void,
): Promise<PreparedPhoto> {
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const check = checkPhoto(file.size, head);
  if (!check.ok) throw new PhotoError(check.reason);

  onPhase?.("reading");
  // Toujours sur le fichier d'origine : la conversion HEIC perdrait l'EXIF.
  const meta = await readPhotoMetadata(file);

  let decodable: Blob = file;
  let image: HTMLImageElement;
  try {
    image = await loadImage(file);
  } catch (error) {
    if (check.kind !== "heic") throw error;
    // Chrome, Firefox : pas de décodeur HEIC natif.
    onPhase?.("converting");
    try {
      decodable = await heicToJpeg(file);
    } catch {
      throw new PhotoError("decode");
    }
    image = await loadImage(decodable);
  }

  return {
    file,
    kind: check.kind,
    decodable,
    previewUrl: URL.createObjectURL(decodable),
    width: image.naturalWidth,
    height: image.naturalHeight,
    meta,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeWithWasm(imageData: ImageData, quality: number): Promise<Blob> {
  const { default: encode } = await import("@jsquash/webp/encode");
  const buffer = await encode(imageData, { quality: Math.round(quality * 100) });
  return new Blob([buffer], { type: "image/webp" });
}

export type ReencodeOptions = { maxSide?: number; quality?: number; forceWasm?: boolean };

/** Photo réencodée en WebP sans aucune métadonnée, 2048 px au plus. */
export async function reencodeToWebp(source: Blob, options: ReencodeOptions = {}): Promise<Blob> {
  const { maxSide = MAX_PHOTO_SIDE, quality = 0.85, forceWasm = false } = options;
  const image = await loadImage(source);
  const { width, height } = targetSize(image.naturalWidth, image.naturalHeight, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new PhotoError("encode");
  // Fond blanc : une photo PNG transparente devient opaque (pas de canal alpha).
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  let blob = forceWasm ? null : await canvasToBlob(canvas, "image/webp", quality);
  if (!blob || blob.type !== "image/webp") {
    try {
      blob = await encodeWithWasm(context.getImageData(0, 0, width, height), quality);
    } catch {
      throw new PhotoError("encode");
    }
  }

  const bytes = stripWebpMetadata(new Uint8Array(await blob.arrayBuffer()));
  const inspection = inspectWebp(bytes);
  if (inspection.metadata.length > 0) throw new PhotoError("metadata");
  if (inspection.problems.length > 0) throw new PhotoError("encode");
  return new Blob([new Uint8Array(bytes)], { type: "image/webp" });
}
