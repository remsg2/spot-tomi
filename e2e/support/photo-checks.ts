import { expect, type Page } from "@playwright/test";
import { inspectWebp } from "../../supabase/functions/_shared/webp-metadata";

/** Photos de test (voir e2e/fixtures/make-fixtures.py). */
export const GPS_PHOTO = "e2e/fixtures/sticker-gps.jpg";
export const PLAIN_PHOTO = "e2e/fixtures/sticker-sans-gps.jpg";

/** Traces des métadonnées de la photo d'origine (EXIF, TIFF, GPS, XMP, ICC, textes de l'appareil). */
export const METADATA_NEEDLES: Array<[string, Buffer]> = [
  ["signature EXIF", Buffer.from("Exif\0\0", "latin1")],
  ["en-tête TIFF (Intel)", Buffer.from([0x49, 0x49, 0x2a, 0x00])],
  ["en-tête TIFF (Motorola)", Buffer.from([0x4d, 0x4d, 0x00, 0x2a])],
  ["marque de l'appareil", Buffer.from("SpotTomiTest", "latin1")],
  ["modèle de l'appareil", Buffer.from("Appareil de test", "latin1")],
  ["date EXIF", Buffer.from("2026:03:14", "latin1")],
  ["XMP", Buffer.from("ns.adobe.com", "latin1")],
  ["position XMP", Buffer.from("54,48", "latin1")],
  ["profil ICC", Buffer.from("acsp", "latin1")],
];

export function metadataTraces(bytes: Buffer): string[] {
  return METADATA_NEEDLES.filter(([, needle]) => bytes.includes(needle)).map(([name]) => name);
}

/** WebP d'image fixe, sans chunk de métadonnées ni aucune trace de la photo d'origine. */
export function expectNoMetadata(bytes: Buffer) {
  const inspection = inspectWebp(bytes);
  expect(inspection.problems).toEqual([]);
  expect(inspection.metadata).toEqual([]);
  expect(inspection.chunks.every((id) => ["VP8 ", "VP8L", "VP8X", "ALPH"].includes(id))).toBe(true);
  // Contrôle indépendant du parseur RIFF : aucune trace dans les octets.
  expect(metadataTraces(bytes)).toEqual([]);
}

/** Dimensions lues dans l'en-tête VP8 / VP8X du WebP. */
export function webpSize(bytes: Buffer): { width: number; height: number } {
  const chunk = bytes.toString("latin1", 12, 16);
  if (chunk === "VP8X") {
    return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
  }
  if (chunk === "VP8 ") {
    return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  }
  throw new Error(`Chunk inattendu : ${chunk}`);
}

/** Choisit une photo une fois la page hydratée (les choix sont désactivés avant). */
export async function choosePhoto(page: Page, photo: string) {
  const input = page.getByTestId("photo-input");
  await expect(input).toBeEnabled();
  await input.setInputFiles(photo);
}
