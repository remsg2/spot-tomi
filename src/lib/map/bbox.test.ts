import { describe, expect, it } from "vitest";
import {
  containsArgs,
  containsPoint,
  crossesAntimeridian,
  padBounds,
  splitArgs,
  toBboxArgs,
  wrapLng,
} from "./bbox";

describe("wrapLng", () => {
  it("laisse les longitudes valides intactes", () => {
    expect(wrapLng(2.35)).toBe(2.35);
    expect(wrapLng(-180)).toBe(-180);
    expect(wrapLng(180)).toBe(180);
  });

  it("replie les longitudes dépliées par MapLibre", () => {
    expect(wrapLng(190)).toBe(-170);
    expect(wrapLng(-190)).toBe(170);
    expect(wrapLng(540)).toBe(180);
    expect(wrapLng(370)).toBeCloseTo(10);
  });
});

describe("toBboxArgs", () => {
  it("convertit une vue ordinaire", () => {
    expect(toBboxArgs({ west: -5, south: 42, east: 8, north: 51 })).toEqual({
      min_lng: -5,
      min_lat: 42,
      max_lng: 8,
      max_lat: 51,
    });
  });

  it("une vue qui traverse l'antiméridien donne min_lng > max_lng", () => {
    const args = toBboxArgs({ west: 170, south: -20, east: 190, north: -10 });
    expect(args).toEqual({ min_lng: 170, min_lat: -20, max_lng: -170, max_lat: -10 });
    expect(crossesAntimeridian(args)).toBe(true);
  });

  it("idem quand la vue déborde à l'ouest", () => {
    const args = toBboxArgs({ west: -200, south: 0, east: -150, north: 10 });
    expect(args).toEqual({ min_lng: 160, min_lat: 0, max_lng: -150, max_lat: 10 });
  });

  it("une vue de plus d'un tour du monde couvre toutes les longitudes", () => {
    expect(toBboxArgs({ west: -300, south: -85, east: 300, north: 85 })).toMatchObject({
      min_lng: -180,
      max_lng: 180,
    });
  });

  it("borne les latitudes et arrondit à 5 décimales", () => {
    const args = toBboxArgs({ west: 1.123456789, south: -95, east: 2, north: 95 });
    expect(args).toEqual({ min_lng: 1.12346, min_lat: -90, max_lng: 2, max_lat: 90 });
  });
});

describe("padBounds", () => {
  it("agrandit la zone de chaque côté, sans dépasser Mercator en latitude", () => {
    expect(padBounds({ west: 0, south: 80, east: 10, north: 84 }, 0.5)).toEqual({
      west: -5,
      east: 15,
      south: 78,
      north: 85.0511,
    });
  });
});

describe("zones et antiméridien", () => {
  const crossing = { min_lng: 170, min_lat: -20, max_lng: -170, max_lat: -10 };

  it("découpe une zone qui traverse 180°", () => {
    expect(splitArgs(crossing)).toEqual([
      { min_lng: 170, min_lat: -20, max_lng: 180, max_lat: -10 },
      { min_lng: -180, min_lat: -20, max_lng: -170, max_lat: -10 },
    ]);
  });

  it("trouve les points des deux côtés", () => {
    expect(containsPoint(crossing, 179.9, -16.8)).toBe(true);
    expect(containsPoint(crossing, -179.9, -16.8)).toBe(true);
    expect(containsPoint(crossing, 0, -16.8)).toBe(false);
    expect(containsPoint(crossing, 179.9, 0)).toBe(false);
  });

  it("sait si une zone est déjà couverte par la précédente", () => {
    const loaded = { min_lng: -10, min_lat: 35, max_lng: 20, max_lat: 60 };
    expect(containsArgs(loaded, { min_lng: -5, min_lat: 40, max_lng: 10, max_lat: 55 })).toBe(true);
    expect(containsArgs(loaded, { min_lng: -15, min_lat: 40, max_lng: 10, max_lat: 55 })).toBe(false);
    expect(containsArgs(crossing, { min_lng: 175, min_lat: -18, max_lng: -175, max_lat: -12 })).toBe(true);
    expect(containsArgs(crossing, { min_lng: 175, min_lat: -18, max_lng: 179, max_lat: -12 })).toBe(true);
    expect(containsArgs(loaded, crossing)).toBe(false);
  });
});
