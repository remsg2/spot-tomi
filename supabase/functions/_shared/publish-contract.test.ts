import { describe, expect, it } from "vitest";
import {
  isOwnPhotoPath,
  photoPathFor,
  placeNameSchema,
  publishInputSchema,
  publishResultSchema,
  SQL_ERRORS,
} from "./publish-contract.ts";

const USER = "6f1c2c3e-1111-4a2b-9c3d-0123456789ab";
const FILE = "0b8e9a7c-2222-4d3e-8f00-abcdefabcdef";

const valid = {
  photoPath: photoPathFor(USER, FILE),
  lat: -54.8019,
  lng: -68.303,
  altitude: 25.5,
  takenAt: "2026-03-14T19:42:00.000Z",
  gpsSource: "exif",
  dateSource: "exif",
  name: "  Panneau   du bout du monde ",
};

describe("placeNameSchema", () => {
  it("nettoie les espaces et exige 1 à 80 caractères", () => {
    expect(placeNameSchema.parse("  Mont   Blanc ")).toBe("Mont Blanc");
    expect(placeNameSchema.safeParse("   ").error?.issues[0].message).toBe("name_required");
    expect(placeNameSchema.safeParse("é".repeat(81)).error?.issues[0].message).toBe("name_too_long");
    expect(placeNameSchema.parse("é".repeat(80))).toHaveLength(80);
  });
});

describe("publishInputSchema", () => {
  it("accepte l'entrée du contrat et normalise le nom", () => {
    const parsed = publishInputSchema.parse(valid);
    expect(parsed.name).toBe("Panneau du bout du monde");
    expect(parsed.altitude).toBe(25.5);
  });

  it("altitude et date facultatives (null), mais date exigée si elle vient de la photo", () => {
    expect(publishInputSchema.parse({ ...valid, altitude: undefined }).altitude).toBeNull();
    expect(publishInputSchema.parse({ ...valid, takenAt: null, dateSource: "upload" }).takenAt).toBeNull();
    expect(publishInputSchema.safeParse({ ...valid, takenAt: null }).success).toBe(false);
  });

  it("refuse les valeurs hors limites ou d'un autre format", () => {
    for (const patch of [
      { lat: 91 },
      { lng: -181 },
      { lat: Number.NaN },
      { altitude: 12_000 },
      { gpsSource: "gps" },
      { dateSource: "camera" },
      { takenAt: "14/03/2026" },
      { photoPath: `${USER}/${FILE}.jpg` },
      { photoPath: `../${USER}/${FILE}.webp` },
      { name: "" },
    ]) {
      expect(publishInputSchema.safeParse({ ...valid, ...patch }).success, JSON.stringify(patch)).toBe(false);
    }
  });
});

describe("isOwnPhotoPath", () => {
  it("vérifie que la photo est dans le dossier de l'utilisateur", () => {
    expect(isOwnPhotoPath(photoPathFor(USER, FILE), USER)).toBe(true);
    expect(isOwnPhotoPath(photoPathFor(FILE, USER), USER)).toBe(false);
    expect(isOwnPhotoPath(`${USER}/sous/${FILE}.webp`, USER)).toBe(false);
  });
});

describe("contrat de sortie", () => {
  it("décrit la réponse de publish-spot", () => {
    const result = {
      spot: {
        id: FILE,
        name: "Panneau",
        city: null,
        countryNameFr: "Argentine",
        year: 2026,
        colorHex: "#5B8DEF",
        status: "pending_review",
        pointsTotal: 195,
        isFirstInCountry: true,
        isExceptional: false,
      },
      lines: [{ ruleKey: "base", label: "Pays lointain", detail: null, points: 25 }],
      rank: { before: null, after: null },
    };
    expect(publishResultSchema.parse(result)).toEqual(result);
  });

  it("associe chaque code SQL de create_spot à un code et un statut HTTP", () => {
    expect(SQL_ERRORS.ST002).toEqual({ code: "suspended", status: 403 });
    expect(SQL_ERRORS.ST003).toEqual({ code: "daily_limit", status: 429 });
    expect(SQL_ERRORS.ST004).toEqual({ code: "nearby_today", status: 409 });
    expect(SQL_ERRORS.ST008).toEqual({ code: "edition_unavailable", status: 400 });
    expect(SQL_ERRORS.ST009).toEqual({ code: "invalid_date", status: 400 });
    expect(Object.keys(SQL_ERRORS).sort()).toEqual([
      "28000", "P0002", "ST001", "ST002", "ST003", "ST004", "ST005", "ST006", "ST007", "ST008", "ST009",
    ]);
  });
});
