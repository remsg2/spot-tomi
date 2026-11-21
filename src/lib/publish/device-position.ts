/**
 * Position et heure du téléphone pour une photo prise à l'instant.
 *
 * Sur iPhone, Safari retire la position (et parfois la date) des photos qu'il
 * transmet à un site : toujours pour une photo prise depuis le navigateur, et
 * pour une photo de la galerie sauf si « Lieu » est activé dans ses options.
 * Quand la photo vient d'être prise (bouton « Prendre une photo », ou date de
 * la photo de moins de 10 minutes), la position du téléphone la remplace :
 * source « device », vérifiée comme le GPS de la photo (migration
 * 20261129000000_capture). Une photo plus ancienne sans GPS reste à placer à
 * la main, en attente de modération.
 */
import { ALTITUDE_RANGE } from "./exif";
import { isValidLatLng, type LatLng } from "./geo";

export type PhotoOrigin = "camera" | "library";

export type DevicePosition = { point: LatLng; altitude: number | null; accuracy: number };

/** Photo de la galerie considérée comme « prise à l'instant ». */
export const FRESH_PHOTO_MS = 10 * 60_000;
/** Au-delà, la position du téléphone est trop imprécise pour remplacer le GPS de la photo. */
export const DEVICE_ACCURACY_MAX_M = 100;
/** Précision verticale minimale pour retenir l'altitude du téléphone. */
export const DEVICE_ALTITUDE_ACCURACY_MAX_M = 50;

/** Photo qui vient d'être prise : appareil photo de l'app, ou date de la photo toute récente. */
export function isFreshPhoto(origin: PhotoOrigin, takenAt: string | null, now: number = Date.now()): boolean {
  if (origin === "camera") return true;
  if (!takenAt) return false;
  const age = now - Date.parse(takenAt);
  return Number.isFinite(age) && age >= -60_000 && age <= FRESH_PHOTO_MS;
}

type CoordinatesLike = {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
};

/** Position du téléphone utilisable, ou null (imprécise ou invalide). */
export function toDevicePosition(coords: CoordinatesLike): DevicePosition | null {
  const point = { lat: Math.round(coords.latitude * 1e7) / 1e7, lng: Math.round(coords.longitude * 1e7) / 1e7 };
  if (!isValidLatLng(point) || !(coords.accuracy >= 0) || coords.accuracy > DEVICE_ACCURACY_MAX_M) return null;
  let altitude: number | null = null;
  if (
    typeof coords.altitude === "number" &&
    Number.isFinite(coords.altitude) &&
    typeof coords.altitudeAccuracy === "number" &&
    coords.altitudeAccuracy <= DEVICE_ALTITUDE_ACCURACY_MAX_M &&
    coords.altitude >= ALTITUDE_RANGE.min &&
    coords.altitude <= ALTITUDE_RANGE.max
  ) {
    altitude = Math.round(coords.altitude * 10) / 10;
  }
  return { point, altitude, accuracy: coords.accuracy };
}

/** Demande la position du téléphone (autorisation du navigateur). Ne lève pas : null si refusée ou imprécise. */
export function readDevicePosition(timeoutMs = 12_000): Promise<DevicePosition | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(toDevicePosition(position.coords)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export { isAppleMobile } from "@/lib/platform";
