import { describe, expect, it } from "vitest";
import { toProfileSpot } from "./mappers";
import {
  countsForScore,
  filterSpotsByYear,
  formatSpotDate,
  resolveYear,
  spotSubline,
  spotYears,
  type ProfileSpot,
} from "./spots";

function spot(id: string, year: number, color: string, status: ProfileSpot["status"] = "published"): ProfileSpot {
  return {
    id,
    name: `Lieu ${id}`,
    city: "Ushuaïa",
    countryIso2: "AR",
    countryName: "Argentine",
    year,
    colorHex: color,
    status,
    points: 25,
    isFirstInCountry: false,
    isExceptional: false,
    takenAt: `${year}-06-03T12:00:00Z`,
  };
}

const SPOTS = [
  spot("a", 2026, "#5B8DEF"),
  spot("b", 2026, "#5B8DEF", "pending_review"),
  spot("c", 2025, "#FF7A59"),
  spot("d", 2024, "#F2C230", "hidden"),
];

describe("filtre par année", () => {
  it("années de la plus récente à la plus ancienne, avec couleur et nombre", () => {
    expect(spotYears(SPOTS)).toEqual([
      { year: 2026, color: "#5B8DEF", count: 2 },
      { year: 2025, color: "#FF7A59", count: 1 },
      { year: 2024, color: "#F2C230", count: 1 },
    ]);
  });

  it("filtre sans changer l'ordre ; null : tous", () => {
    expect(filterSpotsByYear(SPOTS, 2026).map((s) => s.id)).toEqual(["a", "b"]);
    expect(filterSpotsByYear(SPOTS, null).map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
    expect(filterSpotsByYear(SPOTS, 1999)).toEqual([]);
  });

  it("revient à « tous » si l'année demandée n'existe plus", () => {
    expect(resolveYear(SPOTS, 2025)).toBe(2025);
    expect(resolveYear(SPOTS, 2019)).toBeNull();
    expect(resolveYear(SPOTS, null)).toBeNull();
  });
});

describe("mise en forme des stickers", () => {
  it("date française, ville et pays", () => {
    expect(formatSpotDate("2027-06-03T12:00:00Z")).toBe("3 juin 2027");
    expect(spotSubline(spot("a", 2027, "#5DB043"))).toBe("Ushuaïa · Argentine · 3 juin 2027");
    expect(spotSubline({ city: null, countryName: null, takenAt: "2026-01-01T12:00:00Z" })).toBe("1 janvier 2026");
  });

  it("seuls les stickers publiés comptent au score", () => {
    expect(SPOTS.filter(countsForScore).map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("convertit une ligne de public.profile_spots", () => {
    expect(
      toProfileSpot({
        id: "s1",
        name: "Dubrovnik",
        city: "Dubrovnik",
        country_iso2: "HR",
        country_name_fr: "Croatie",
        year: 2027,
        color_hex: "#5DB043",
        status: "pending_review",
        points_total: 85,
        is_first_in_country: true,
        is_exceptional: false,
        taken_at: "2027-06-03T10:00:00+00:00",
      }),
    ).toEqual({
      id: "s1",
      name: "Dubrovnik",
      city: "Dubrovnik",
      countryIso2: "HR",
      countryName: "Croatie",
      year: 2027,
      colorHex: "#5DB043",
      status: "pending_review",
      points: 85,
      isFirstInCountry: true,
      isExceptional: false,
      takenAt: "2027-06-03T10:00:00+00:00",
    });
  });
});
