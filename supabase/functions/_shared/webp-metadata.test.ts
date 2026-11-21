import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { inspectWebp, isCleanWebp, stripWebpMetadata } from "./webp-metadata.ts";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../../../e2e/fixtures/${name}`, import.meta.url))));

/** Construit un WebP synthétique à partir de chunks (FourCC, contenu). */
function webp(chunks: Array<[string, Uint8Array | number[]]>, { trailing = 0, riffDelta = 0 } = {}): Uint8Array {
  const parts: number[] = [];
  for (const [id, data] of chunks) {
    const bytes = Array.from(data);
    parts.push(...[...id].map((c) => c.charCodeAt(0)));
    const size = bytes.length;
    parts.push(size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff, ...bytes);
    if (size % 2) parts.push(0);
  }
  const riffSize = 4 + parts.length + riffDelta;
  const header = [
    ..."RIFF".split("").map((c) => c.charCodeAt(0)),
    riffSize & 0xff,
    (riffSize >> 8) & 0xff,
    (riffSize >> 16) & 0xff,
    (riffSize >> 24) & 0xff,
    ..."WEBP".split("").map((c) => c.charCodeAt(0)),
  ];
  return new Uint8Array([...header, ...parts, ...new Array(trailing).fill(0)]);
}

const VP8 = new Array(11).fill(1); // impair : teste le bourrage
const vp8x = (flags: number) => [flags, 0, 0, 0, 9, 0, 0, 9, 0, 0];

describe("inspectWebp", () => {
  it("accepte une image fixe sans métadonnées", () => {
    const result = inspectWebp(webp([["VP8 ", VP8]]));
    expect(result).toEqual({ chunks: ["VP8 "], metadata: [], unexpected: [], problems: [] });
    expect(isCleanWebp(webp([["VP8L", [1, 2, 3, 4]]]))).toBe(true);
    expect(isCleanWebp(webp([["VP8X", vp8x(0x10)], ["ALPH", [1, 2]], ["VP8 ", VP8]]))).toBe(true);
  });

  it("refuse un chunk EXIF (position GPS)", () => {
    const result = inspectWebp(webp([["VP8 ", VP8], ["EXIF", [0x4d, 0x4d, 0, 0x2a]]]));
    expect(result.metadata).toEqual(["EXIF"]);
    expect(result.problems).toContain("metadata");
  });

  it("refuse un chunk XMP et un profil ICC, et les drapeaux VP8X qui les annoncent", () => {
    const result = inspectWebp(
      webp([["VP8X", vp8x(0x20 | 0x08 | 0x04)], ["ICCP", [1, 2, 3]], ["VP8 ", VP8], ["XMP ", [60, 120]]]),
    );
    expect(result.metadata).toHaveLength(5);
    expect(result.metadata).toEqual(expect.arrayContaining(["ICCP", "XMP ", "VP8X:EXIF", "VP8X:XMP", "VP8X:ICC"]));
    expect(isCleanWebp(webp([["VP8X", vp8x(0x08)], ["VP8 ", VP8]]))).toBe(false);
  });

  it("refuse un chunk inconnu, qui pourrait cacher des données", () => {
    const result = inspectWebp(webp([["VP8 ", VP8], ["GPS!", [1, 2]]]));
    expect(result.unexpected).toEqual(["GPS!"]);
    expect(result.problems).toEqual(["unexpected_chunk"]);
    expect(inspectWebp(webp([["ANIM", [0, 0, 0, 0, 0, 0]], ["VP8 ", VP8]])).problems).toContain("unexpected_chunk");
  });

  it("refuse des octets après la fin du RIFF et un fichier tronqué", () => {
    expect(inspectWebp(webp([["VP8 ", VP8]], { trailing: 6 })).problems).toEqual(["trailing_data"]);
    const truncated = webp([["VP8 ", VP8]]).slice(0, 20);
    expect(inspectWebp(truncated).problems).toContain("truncated");
    expect(inspectWebp(webp([["VP8 ", VP8]], { riffDelta: 40 })).problems).toContain("truncated");
  });

  it("refuse ce qui n'est pas un WebP ou n'a pas d'image", () => {
    expect(inspectWebp(new Uint8Array([0xff, 0xd8, 0xff, 0xe1])).problems).toEqual(["not_riff"]);
    const wave = webp([["VP8 ", VP8]]);
    wave.set([0x57, 0x41, 0x56, 0x45], 8);
    expect(inspectWebp(wave).problems).toEqual(["not_webp"]);
    expect(inspectWebp(webp([["VP8X", vp8x(0)]])).problems).toEqual(["no_image"]);
  });

  it("repère EXIF, XMP et ICC dans un vrai WebP produit par libwebp", () => {
    const dirty = inspectWebp(fixture("webp-avec-metadonnees.webp"));
    expect(dirty.chunks).toEqual(["VP8X", "ICCP", "VP8 ", "EXIF", "XMP "]);
    expect(dirty.metadata).toEqual(expect.arrayContaining(["ICCP", "EXIF", "XMP ", "VP8X:EXIF", "VP8X:XMP", "VP8X:ICC"]));
    expect(isCleanWebp(fixture("webp-avec-metadonnees.webp"))).toBe(false);
  });

  it("accepte un vrai WebP sans métadonnées", () => {
    expect(inspectWebp(fixture("webp-propre.webp"))).toMatchObject({ chunks: ["VP8 "], problems: [] });
  });
});

describe("stripWebpMetadata", () => {
  it("retire le profil ICC qu'ajoute le canvas de Chromium (VP8X + ICCP + VP8 → VP8)", () => {
    const chrome = webp([["VP8X", vp8x(0x20)], ["ICCP", new Array(456).fill(7)], ["VP8 ", VP8]]);
    const stripped = stripWebpMetadata(chrome);
    expect(inspectWebp(stripped)).toEqual({ chunks: ["VP8 "], metadata: [], unexpected: [], problems: [] });
    expect(stripped).toEqual(webp([["VP8 ", VP8]]));
  });

  it("garde la transparence (VP8X + ALPH) mais efface les drapeaux de métadonnées", () => {
    const stripped = stripWebpMetadata(
      webp([["VP8X", vp8x(0x10 | 0x20 | 0x08 | 0x04)], ["ICCP", [1, 2]], ["ALPH", [3]], ["VP8 ", VP8], ["EXIF", [4]], ["XMP ", [5]]]),
    );
    const inspection = inspectWebp(stripped);
    expect(inspection.chunks).toEqual(["VP8X", "ALPH", "VP8 "]);
    expect(inspection.problems).toEqual([]);
    expect(stripped[20]).toBe(0x10);
  });

  it("nettoie un vrai WebP chargé d'EXIF, XMP et ICC sans toucher à l'image", () => {
    const dirty = fixture("webp-avec-metadonnees.webp");
    const stripped = stripWebpMetadata(dirty);
    expect(inspectWebp(stripped)).toMatchObject({ chunks: ["VP8 "], problems: [] });
    // Le flux VP8 est identique, octet pour octet.
    const vp8Of = (bytes: Uint8Array) => {
      const text = String.fromCharCode(...bytes);
      const at = text.indexOf("VP8 ");
      const size = bytes[at + 4] | (bytes[at + 5] << 8) | (bytes[at + 6] << 16) | (bytes[at + 7] << 24);
      return bytes.slice(at, at + 8 + size);
    };
    expect(vp8Of(stripped)).toEqual(vp8Of(dirty));
    expect(String.fromCharCode(...stripped)).not.toContain("SpotTomiTest");
  });

  it("laisse intact un fichier propre ou illisible", () => {
    const clean = fixture("webp-propre.webp");
    expect(stripWebpMetadata(clean)).toEqual(clean);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(stripWebpMetadata(jpeg)).toBe(jpeg);
    // Chunk VP8 coupé au milieu : rien n'est réécrit.
    const truncated = webp([["VP8 ", VP8], ["EXIF", [1, 2, 3, 4]]]).slice(0, 24);
    expect(stripWebpMetadata(truncated)).toBe(truncated);
  });
});
