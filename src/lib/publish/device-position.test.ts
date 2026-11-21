import { describe, expect, it } from "vitest";
import { DEVICE_ACCURACY_MAX_M, FRESH_PHOTO_MS, isFreshPhoto, toDevicePosition } from "./device-position";

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);

describe("photo prise à l'instant", () => {
  it("toujours pour le bouton « Prendre une photo »", () => {
    expect(isFreshPhoto("camera", null, NOW)).toBe(true);
    expect(isFreshPhoto("camera", "2020-01-01T00:00:00Z", NOW)).toBe(true);
  });

  it("galerie : seulement si la photo date de moins de 10 minutes", () => {
    expect(isFreshPhoto("library", null, NOW)).toBe(false);
    expect(isFreshPhoto("library", new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe(true);
    expect(isFreshPhoto("library", new Date(NOW - FRESH_PHOTO_MS - 1000).toISOString(), NOW)).toBe(false);
    expect(isFreshPhoto("library", new Date(NOW + 10 * 60_000).toISOString(), NOW)).toBe(false);
    expect(isFreshPhoto("library", "pas une date", NOW)).toBe(false);
  });
});

describe("position du téléphone", () => {
  it("retenue si précise, arrondie comme le GPS des photos", () => {
    expect(toDevicePosition({ latitude: -54.80190001, longitude: -68.30300004, accuracy: 15 })).toEqual({
      point: { lat: -54.8019, lng: -68.303 },
      altitude: null,
      accuracy: 15,
    });
  });

  it("refusée si trop imprécise ou invalide", () => {
    expect(toDevicePosition({ latitude: 45, longitude: 6, accuracy: DEVICE_ACCURACY_MAX_M + 1 })).toBeNull();
    expect(toDevicePosition({ latitude: 95, longitude: 6, accuracy: 10 })).toBeNull();
    expect(toDevicePosition({ latitude: Number.NaN, longitude: 6, accuracy: 10 })).toBeNull();
  });

  it("altitude seulement si sa précision est bonne et plausible", () => {
    expect(toDevicePosition({ latitude: 45.83, longitude: 6.86, accuracy: 10, altitude: 4808.04, altitudeAccuracy: 12 })?.altitude).toBe(4808);
    expect(toDevicePosition({ latitude: 45.83, longitude: 6.86, accuracy: 10, altitude: 4808, altitudeAccuracy: 80 })?.altitude).toBeNull();
    expect(toDevicePosition({ latitude: 45.83, longitude: 6.86, accuracy: 10, altitude: 12000, altitudeAccuracy: 5 })?.altitude).toBeNull();
  });
});
