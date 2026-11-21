/**
 * Inspection d'un fichier WebP (conteneur RIFF), sans dépendance : partagée
 * par le navigateur (contrôle avant envoi), l'Edge Function publish-spot
 * (contrôle du fichier stocké) et les tests.
 *
 * Règle (spécifications 2.7) : la photo stockée ne doit contenir AUCUNE
 * métadonnée. On n'accepte donc qu'une liste fermée de chunks d'image
 * (VP8, VP8L, VP8X, ALPH) : EXIF, XMP et ICCP sont refusés, comme tout
 * chunk inconnu (qui pourrait cacher les mêmes données) ou des octets
 * après la fin du RIFF. Les drapeaux EXIF/XMP/ICC de VP8X comptent aussi.
 *
 * Format : https://developers.google.com/speed/webp/docs/riff_container
 */

/** Chunks d'image autorisés dans une photo publiée (image fixe). */
export const ALLOWED_WEBP_CHUNKS = ["VP8 ", "VP8L", "VP8X", "ALPH"] as const;

/** Chunks de métadonnées, toujours refusés. */
export const METADATA_WEBP_CHUNKS = ["EXIF", "XMP ", "ICCP"] as const;

export type WebpProblem =
  | "not_riff"
  | "not_webp"
  | "truncated"
  | "trailing_data"
  | "no_image"
  | "metadata"
  | "unexpected_chunk";

export type WebpInspection = {
  /** Chunks trouvés, dans l'ordre (FourCC sur 4 caractères). */
  chunks: string[];
  /** Métadonnées trouvées : chunks EXIF/XMP/ICCP ou drapeaux VP8X. */
  metadata: string[];
  /** Chunks hors de la liste autorisée (hors métadonnées). */
  unexpected: string[];
  /** Vide si le fichier est un WebP propre. */
  problems: WebpProblem[];
};

const VP8X_FLAG_ICC = 0x20;
const VP8X_FLAG_EXIF = 0x08;
const VP8X_FLAG_XMP = 0x04;

function fourCC(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function uint32le(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  );
}

/** Analyse les chunks d'un WebP. Ne lève jamais d'exception. */
export function inspectWebp(input: ArrayBuffer | Uint8Array): WebpInspection {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const result: WebpInspection = { chunks: [], metadata: [], unexpected: [], problems: [] };

  if (bytes.length < 12 || fourCC(bytes, 0) !== "RIFF") {
    result.problems.push("not_riff");
    return result;
  }
  if (fourCC(bytes, 8) !== "WEBP") {
    result.problems.push("not_webp");
    return result;
  }

  const riffEnd = 8 + uint32le(bytes, 4);
  if (riffEnd > bytes.length) result.problems.push("truncated");
  if (riffEnd < bytes.length) result.problems.push("trailing_data");
  const end = Math.min(riffEnd, bytes.length);

  let offset = 12;
  while (offset < end) {
    if (offset + 8 > end) {
      if (!result.problems.includes("truncated")) result.problems.push("truncated");
      break;
    }
    const id = fourCC(bytes, offset);
    const size = uint32le(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    result.chunks.push(id);

    if ((METADATA_WEBP_CHUNKS as readonly string[]).includes(id)) {
      result.metadata.push(id);
    } else if (!(ALLOWED_WEBP_CHUNKS as readonly string[]).includes(id)) {
      result.unexpected.push(id);
    }

    if (id === "VP8X" && size >= 1 && dataStart < bytes.length) {
      const flags = bytes[dataStart];
      if (flags & VP8X_FLAG_EXIF) result.metadata.push("VP8X:EXIF");
      if (flags & VP8X_FLAG_XMP) result.metadata.push("VP8X:XMP");
      if (flags & VP8X_FLAG_ICC) result.metadata.push("VP8X:ICC");
    }

    if (dataEnd > end) {
      if (!result.problems.includes("truncated")) result.problems.push("truncated");
      break;
    }
    // Chaque chunk est complété à une taille paire.
    offset = dataEnd + (size % 2);
  }

  if (!result.chunks.some((id) => id === "VP8 " || id === "VP8L")) result.problems.push("no_image");
  if (result.metadata.length > 0) result.problems.push("metadata");
  if (result.unexpected.length > 0) result.problems.push("unexpected_chunk");
  return result;
}

/** Vrai si le fichier est un WebP d'image fixe sans aucune métadonnée. */
export function isCleanWebp(input: ArrayBuffer | Uint8Array): boolean {
  return inspectWebp(input).problems.length === 0;
}

/**
 * Retire les chunks EXIF, XMP et ICCP d'un WebP et efface les drapeaux VP8X
 * correspondants. Chromium ajoute en effet un profil ICC (sRVB générique) à
 * tout WebP produit par un canvas : sans lui, l'image reste en sRVB, la
 * couleur par défaut du WebP. Si VP8X n'annonce plus rien (pas de
 * transparence), le fichier redevient un WebP simple (un seul chunk VP8).
 * Un fichier illisible est renvoyé tel quel (inspectWebp le refusera).
 */
export function stripWebpMetadata(input: ArrayBuffer | Uint8Array): Uint8Array {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 12 || fourCC(bytes, 0) !== "RIFF" || fourCC(bytes, 8) !== "WEBP") return bytes;

  const end = Math.min(8 + uint32le(bytes, 4), bytes.length);
  const kept: Array<{ id: string; data: Uint8Array }> = [];
  let offset = 12;
  while (offset + 8 <= end) {
    const id = fourCC(bytes, offset);
    const size = uint32le(bytes, offset + 4);
    const dataEnd = offset + 8 + size;
    if (dataEnd > end) return bytes;
    if (!(METADATA_WEBP_CHUNKS as readonly string[]).includes(id)) {
      kept.push({ id, data: bytes.slice(offset + 8, dataEnd) });
    }
    offset = dataEnd + (size % 2);
  }

  const vp8x = kept.find((chunk) => chunk.id === "VP8X");
  if (vp8x && vp8x.data.length >= 1) {
    vp8x.data[0] &= ~(VP8X_FLAG_ICC | VP8X_FLAG_EXIF | VP8X_FLAG_XMP);
    const others = kept.filter((chunk) => chunk !== vp8x);
    if (vp8x.data[0] === 0 && others.length === 1 && (others[0].id === "VP8 " || others[0].id === "VP8L")) {
      kept.splice(kept.indexOf(vp8x), 1);
    }
  }

  const length = 12 + kept.reduce((total, chunk) => total + 8 + chunk.data.length + (chunk.data.length % 2), 0);
  const out = new Uint8Array(length);
  const view = new DataView(out.buffer);
  const writeId = (id: string, at: number) => {
    for (let i = 0; i < 4; i += 1) out[at + i] = id.charCodeAt(i);
  };
  writeId("RIFF", 0);
  view.setUint32(4, length - 8, true);
  writeId("WEBP", 8);
  let at = 12;
  for (const chunk of kept) {
    writeId(chunk.id, at);
    view.setUint32(at + 4, chunk.data.length, true);
    out.set(chunk.data, at + 8);
    at += 8 + chunk.data.length + (chunk.data.length % 2);
  }
  return out;
}
