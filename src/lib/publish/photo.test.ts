import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatCoordinates, formatTakenAt, ordinal } from "@/i18n/publish.fr";
import { MAX_PHOTO_BYTES } from "./contract";
import { checkPhoto, detectPhotoKind, targetSize } from "./photo";
import { toPointLines } from "./points";
import { isPending, statusFor } from "./status";

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const head = (name: string) =>
  new Uint8Array(readFileSync(fileURLToPath(new URL(`../../../e2e/fixtures/${name}`, import.meta.url))).subarray(0, 32));

describe("detectPhotoKind", () => {
  it("reconnaît JPEG, PNG et HEIC à leur signature", () => {
    expect(detectPhotoKind(head("sticker-gps.jpg"))).toBe("jpeg");
    expect(detectPhotoKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(detectPhotoKind(bytes(0, 0, 0, 0x18, ...ascii("ftypheic"), 0, 0, 0, 0))).toBe("heic");
    expect(detectPhotoKind(bytes(0, 0, 0, 0x18, ...ascii("ftypmif1")))).toBe("heic");
  });

  it("refuse les autres formats, même renommés", () => {
    expect(detectPhotoKind(head("webp-propre.webp"))).toBeNull();
    expect(detectPhotoKind(bytes(0, 0, 0, 0x1c, ...ascii("ftypavif")))).toBeNull();
    expect(detectPhotoKind(bytes(...ascii("GIF89a")))).toBeNull();
    expect(detectPhotoKind(bytes())).toBeNull();
  });
});

describe("checkPhoto", () => {
  it("limite la taille à 20 Mo", () => {
    expect(checkPhoto(MAX_PHOTO_BYTES, head("sticker-gps.jpg"))).toEqual({ ok: true, kind: "jpeg" });
    expect(checkPhoto(MAX_PHOTO_BYTES + 1, head("sticker-gps.jpg"))).toEqual({ ok: false, reason: "too_big" });
    expect(checkPhoto(0, bytes())).toEqual({ ok: false, reason: "empty" });
    expect(checkPhoto(1000, head("webp-propre.webp"))).toEqual({ ok: false, reason: "unsupported" });
  });
});

describe("targetSize", () => {
  it("réduit le plus grand côté à 2048 px sans jamais agrandir", () => {
    expect(targetSize(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(targetSize(3024, 4032)).toEqual({ width: 1536, height: 2048 });
    expect(targetSize(8064, 100)).toEqual({ width: 2048, height: 25 });
    expect(targetSize(1600, 1200)).toEqual({ width: 1600, height: 1200 });
    expect(targetSize(10_000, 1)).toEqual({ width: 2048, height: 1 });
    expect(() => targetSize(0, 100)).toThrow();
  });
});

describe("statusFor : même règle que create_spot", () => {
  it("en attente sans GPS ou sans date dans la photo", () => {
    expect(statusFor("exif", "exif")).toBe("published");
    expect(statusFor("manual", "exif")).toBe("pending_review");
    expect(statusFor("exif", "upload")).toBe("pending_review");
    expect(statusFor("manual", "upload")).toBe("pending_review");
    expect(isPending("published")).toBe(false);
    expect(isPending("hidden")).toBe(true);
  });
});

describe("affichage", () => {
  it("coordonnées, date et rang en français", () => {
    expect(formatCoordinates(-54.8019, -68.303)).toBe("54,80° S, 68,30° O");
    expect(formatCoordinates(48.8566, 2.3522)).toBe("48,86° N, 2,35° E");
    expect(formatTakenAt("2026-03-14T16:42:00")).toBe("14 mars 2026 à 16:42");
    expect(ordinal(1)).toBe("1er");
    expect(ordinal(2)).toBe("2ᵉ");
  });

  it("lignes de points : base sans « + », puce dorée pour le premier du pays (adaptateur de l'étape 4)", () => {
    const lines = toPointLines([
      { ruleKey: "base_country", label: "Pays lointain", detail: null, points: 25 },
      { ruleKey: "first_country", label: "Premier sticker du pays", detail: "Argentine", points: 50 },
      { ruleKey: "home_distance", label: "Loin de chez toi", detail: "13 000 km", points: 65 },
      { ruleKey: "neighbor_malus", label: "Voisin à moins de 200 m", detail: null, points: -56 },
    ]);
    expect(lines.map((line) => [line.key, line.isBase, line.tone, line.detail])).toEqual([
      ["base_country", true, "base", undefined],
      ["first_country", false, "gold", "Argentine"],
      ["home_distance", false, "year", "13 000 km"],
      ["neighbor_malus", false, "base", undefined],
    ]);
  });
});
