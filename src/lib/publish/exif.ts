/**
 * Métadonnées utiles d'une photo (spécifications 2.2) : position GPS,
 * altitude et date de prise. Lues dans le navigateur avec exifr, AVANT tout
 * envoi ; la photo envoyée est ensuite réencodée sans aucune métadonnée.
 *
 * `normalizeExif` est pure (testée) ; `readPhotoMetadata` charge exifr à la
 * demande. exifr est appelé avec `reviveValues: false` : les dates restent
 * les chaînes brutes de l'appareil (« 2027:03:14 16:42:00 ») au lieu d'être
 * interprétées dans le fuseau du navigateur.
 */
import type exifr from "exifr";
import { isValidLatLng, type LatLng } from "./geo";

type ExifrOptions = Exclude<Parameters<typeof exifr.parse>[1], boolean | string[] | undefined>;

export type PhotoMetadata = {
  gps: LatLng | null;
  /** Altitude en mètres (négative sous le niveau de la mer), ou null. */
  altitude: number | null;
  /** Instant de la prise (ISO 8601, UTC), envoyé au serveur. */
  takenAt: string | null;
  /** Date et heure affichées sur l'appareil (« AAAA-MM-JJTHH:MM:SS »), pour l'affichage. */
  takenAtLocal: string | null;
};

export const EMPTY_METADATA: PhotoMetadata = { gps: null, altitude: null, takenAt: null, takenAtLocal: null };

/** Altitudes plausibles pour un sticker (mêmes bornes que create_spot). */
export const ALTITUDE_RANGE = { min: -500, max: 9000 } as const;
/** Dates plausibles : pas avant 2000, pas dans le futur (un jour de marge). */
export const EARLIEST_TAKEN_AT = Date.UTC(2000, 0, 1);

type Raw = Record<string, unknown>;

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === "number")) {
    // Rationnel [numérateur, dénominateur].
    const [n, d] = value as [number, number];
    return d === 0 ? null : n / d;
  }
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Premier octet d'une valeur EXIF de type BYTE (nombre, tableau ou Uint8Array). */
function firstByte(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value instanceof Uint8Array || Array.isArray(value)) {
    const first = (value as ArrayLike<unknown>)[0];
    return typeof first === "number" ? first : null;
  }
  return null;
}

function refLetter(value: unknown): string | null {
  if (typeof value === "string") return value.trim().charAt(0).toUpperCase() || null;
  const byte = firstByte(value);
  return byte === null ? null : String.fromCharCode(byte).toUpperCase();
}

/** [degrés, minutes, secondes] (+ référence N/S/E/W) → degrés décimaux. */
function dmsToDecimal(value: unknown, ref: unknown): number | null {
  let degrees: number | null = null;
  if (Array.isArray(value)) {
    const parts = value.map(toNumber);
    if (parts.length === 0 || parts.some((part) => part === null)) return null;
    const [d, m = 0, s = 0] = parts as number[];
    degrees = d + m / 60 + s / 3600;
  } else {
    degrees = toNumber(value);
  }
  if (degrees === null) return null;
  const letter = refLetter(ref);
  return letter === "S" || letter === "W" ? -Math.abs(degrees) : degrees;
}

function readGps(raw: Raw): LatLng | null {
  // exifr calcule latitude/longitude ; sinon, depuis les champs bruts.
  const lat = toNumber(raw.latitude) ?? dmsToDecimal(raw.GPSLatitude, raw.GPSLatitudeRef);
  const lng = toNumber(raw.longitude) ?? dmsToDecimal(raw.GPSLongitude, raw.GPSLongitudeRef);
  if (lat === null || lng === null) return null;
  // GPSStatus « V » : mesure invalide.
  if (refLetter(raw.GPSStatus) === "V") return null;
  const point = { lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 };
  if (!isValidLatLng(point)) return null;
  // 0°, 0° : valeur par défaut de certains appareils, pas une vraie position.
  if (point.lat === 0 && point.lng === 0) return null;
  return point;
}

function readAltitude(raw: Raw): number | null {
  const value = toNumber(raw.GPSAltitude);
  if (value === null) return null;
  const altitude = firstByte(raw.GPSAltitudeRef) === 1 ? -Math.abs(value) : value;
  if (altitude < ALTITUDE_RANGE.min || altitude > ALTITUDE_RANGE.max) return null;
  return Math.round(altitude * 10) / 10;
}

const DATE_PATTERN = /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;
const OFFSET_PATTERN = /^([+-])(\d{2}):?(\d{2})$/;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** « 2027:03:14 16:42:00 » + « +01:00 » → { instant UTC, heure locale }. */
export function parseExifDate(
  value: unknown,
  offset: unknown,
  now: number = Date.now(),
): { takenAt: string; takenAtLocal: string } | null {
  let text: string | null = null;
  if (typeof value === "string") text = value.trim();
  else if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Date déjà interprétée (reviveValues) : on garde ses composantes locales.
    text = `${value.getFullYear()}:${pad(value.getMonth() + 1)}:${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  if (!text) return null;
  const match = DATE_PATTERN.exec(text);
  if (!match) return null;
  const [year, month, day, hours, minutes] = match.slice(1, 6).map(Number);
  const seconds = match[6] === undefined ? 0 : Number(match[6]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) return null;

  const wallClock = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const check = new Date(wallClock);
  // Refuse les dates impossibles (31 février…).
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;

  // Avec un décalage connu, l'instant exact ; sans, l'heure de l'appareil est prise comme UTC.
  let instant = wallClock;
  const offsetMatch = typeof offset === "string" ? OFFSET_PATTERN.exec(offset.trim()) : null;
  if (offsetMatch) {
    const sign = offsetMatch[1] === "-" ? -1 : 1;
    const offsetMinutes = sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]));
    if (Math.abs(offsetMinutes) <= 14 * 60) instant = wallClock - offsetMinutes * 60_000;
  }
  if (instant < EARLIEST_TAKEN_AT || instant > now + 24 * 3600_000) return null;

  return {
    takenAt: new Date(instant).toISOString(),
    takenAtLocal: `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  };
}

/** Normalise la sortie d'exifr en métadonnées sûres et plausibles. */
export function normalizeExif(raw: unknown, now: number = Date.now()): PhotoMetadata {
  if (!raw || typeof raw !== "object") return { ...EMPTY_METADATA };
  const data = raw as Raw;
  const gps = readGps(data);
  const date =
    parseExifDate(data.DateTimeOriginal, data.OffsetTimeOriginal ?? data.OffsetTime, now) ??
    parseExifDate(data.CreateDate ?? data.DateTimeDigitized, data.OffsetTimeDigitized ?? data.OffsetTime, now);
  return {
    gps,
    altitude: gps ? readAltitude(data) : null,
    takenAt: date?.takenAt ?? null,
    takenAtLocal: date?.takenAtLocal ?? null,
  };
}

/** Options exifr : seulement TIFF/EXIF/GPS, valeurs brutes. */
export const EXIFR_OPTIONS = {
  tiff: true,
  exif: true,
  gps: true,
  ifd1: false,
  interop: false,
  makerNote: false,
  userComment: false,
  xmp: false,
  icc: false,
  iptc: false,
  jfif: false,
  ihdr: false,
  translateKeys: true,
  translateValues: false,
  reviveValues: false,
  sanitize: true,
  mergeOutput: true,
} satisfies ExifrOptions;

/** Lit les métadonnées d'une photo d'origine (JPEG, HEIC, PNG). Ne lève pas. */
export async function readPhotoMetadata(file: Blob): Promise<PhotoMetadata> {
  try {
    const exifr = (await import("exifr")).default;
    const raw = await exifr.parse(file, EXIFR_OPTIONS);
    return normalizeExif(raw);
  } catch {
    return { ...EMPTY_METADATA };
  }
}
