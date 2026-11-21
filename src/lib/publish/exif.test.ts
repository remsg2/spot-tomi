import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import exifr from "exifr";
import { describe, expect, it } from "vitest";
import { EXIFR_OPTIONS, normalizeExif, parseExifDate } from "./exif";

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`../../../e2e/fixtures/${name}`, import.meta.url)));

describe("parseExifDate", () => {
  it("lit l'heure de l'appareil, sans fuseau : prise comme UTC", () => {
    expect(parseExifDate("2026:03:14 16:42:00", undefined, NOW)).toEqual({
      takenAt: "2026-03-14T16:42:00.000Z",
      takenAtLocal: "2026-03-14T16:42:00",
    });
  });

  it("applique le décalage horaire quand l'appareil le donne", () => {
    expect(parseExifDate("2026:03:14 16:42:00", "-03:00", NOW)?.takenAt).toBe("2026-03-14T19:42:00.000Z");
    expect(parseExifDate("2026:01:01 00:30:00", "+01:00", NOW)?.takenAt).toBe("2025-12-31T23:30:00.000Z");
    expect(parseExifDate("2026:01:01 00:30:00", "+01:00", NOW)?.takenAtLocal).toBe("2026-01-01T00:30:00");
  });

  it("accepte les variantes courantes (tirets, T, sans secondes)", () => {
    expect(parseExifDate("2026-03-14T16:42", undefined, NOW)?.takenAt).toBe("2026-03-14T16:42:00.000Z");
    expect(parseExifDate("2026:03:14 16:42:05.123", undefined, NOW)?.takenAt).toBe("2026-03-14T16:42:05.000Z");
  });

  it("refuse les dates vides, impossibles, trop anciennes ou futures", () => {
    for (const value of ["0000:00:00 00:00:00", "2026:02:30 10:00:00", "2026:13:01 10:00:00", "1999:12:31 23:59:59", "2027:01:01 00:00:00", "", "    ", 42, null]) {
      expect(parseExifDate(value, undefined, NOW), String(value)).toBeNull();
    }
  });
});

describe("normalizeExif", () => {
  it("lit position, altitude et date (sortie exifr)", () => {
    expect(
      normalizeExif(
        {
          latitude: -54.801899999999996,
          longitude: -68.303,
          GPSAltitude: 25.5,
          GPSAltitudeRef: new Uint8Array([0]),
          DateTimeOriginal: "2026:03:14 16:42:00",
          OffsetTimeOriginal: "-03:00",
        },
        NOW,
      ),
    ).toEqual({
      gps: { lat: -54.8019, lng: -68.303 },
      altitude: 25.5,
      takenAt: "2026-03-14T19:42:00.000Z",
      takenAtLocal: "2026-03-14T16:42:00",
    });
  });

  it("calcule la position depuis les degrés, minutes, secondes et références", () => {
    const meta = normalizeExif(
      { GPSLatitude: [45, 49, 58.8], GPSLatitudeRef: "N", GPSLongitude: [6, 51, 54], GPSLongitudeRef: "E" },
      NOW,
    );
    expect(meta.gps?.lat).toBeCloseTo(45.833, 3);
    expect(meta.gps?.lng).toBeCloseTo(6.865, 3);
    const south = normalizeExif({ GPSLatitude: [[33, 1], [52, 1], [0, 1]], GPSLatitudeRef: "S", GPSLongitude: 151.2, GPSLongitudeRef: "E" }, NOW);
    expect(south.gps?.lat).toBeCloseTo(-33.8667, 4);
    expect(south.gps?.lng).toBe(151.2);
  });

  it("altitude sous le niveau de la mer, ou absurde", () => {
    const base = { latitude: 31.5, longitude: 35.5 };
    expect(normalizeExif({ ...base, GPSAltitude: 430, GPSAltitudeRef: 1 }, NOW).altitude).toBe(-430);
    expect(normalizeExif({ ...base, GPSAltitude: 11_000, GPSAltitudeRef: 0 }, NOW).altitude).toBeNull();
    expect(normalizeExif({ ...base, GPSAltitude: 4808.73 }, NOW).altitude).toBe(4808.7);
  });

  it("ignore une position invalide (0,0 ; hors limites ; mesure nulle)", () => {
    expect(normalizeExif({ latitude: 0, longitude: 0 }, NOW).gps).toBeNull();
    expect(normalizeExif({ latitude: 95, longitude: 10 }, NOW).gps).toBeNull();
    expect(normalizeExif({ latitude: 10, longitude: 10, GPSStatus: "V" }, NOW).gps).toBeNull();
    // Sans position, l'altitude n'a pas de sens.
    expect(normalizeExif({ GPSAltitude: 4000 }, NOW).altitude).toBeNull();
  });

  it("retombe sur CreateDate, et ne garde rien d'une photo sans métadonnées", () => {
    expect(normalizeExif({ CreateDate: "2025:08:01 10:00:00" }, NOW).takenAt).toBe("2025-08-01T10:00:00.000Z");
    expect(normalizeExif(undefined, NOW)).toEqual({ gps: null, altitude: null, takenAt: null, takenAtLocal: null });
    expect(normalizeExif("pas un objet", NOW).gps).toBeNull();
  });
});

describe("photo réelle (e2e/fixtures)", () => {
  it("lit le GPS, l'altitude et la date d'un vrai JPEG d'appareil", async () => {
    const raw = await exifr.parse(fixture("sticker-gps.jpg"), EXIFR_OPTIONS);
    expect(normalizeExif(raw, NOW)).toEqual({
      gps: { lat: -54.8019, lng: -68.303 },
      altitude: 25.5,
      takenAt: "2026-03-14T19:42:00.000Z",
      takenAtLocal: "2026-03-14T16:42:00",
    });
  });

  it("ne trouve rien dans un JPEG sans métadonnées", async () => {
    const raw = await exifr.parse(fixture("sticker-sans-gps.jpg"), EXIFR_OPTIONS);
    expect(normalizeExif(raw, NOW)).toEqual({ gps: null, altitude: null, takenAt: null, takenAtLocal: null });
  });
});
