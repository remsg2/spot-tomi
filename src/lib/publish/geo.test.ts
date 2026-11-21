import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  circlePolygon,
  clampToRadius,
  destination,
  distanceMeters,
  isValidLatLng,
  normalizeLng,
  RADIUS_SAFETY_RATIO,
} from "./geo";

const PARIS = { lat: 48.8566, lng: 2.3522 };
const USHUAIA = { lat: -54.8019, lng: -68.303 };

describe("distanceMeters", () => {
  it("donne les distances attendues", () => {
    expect(distanceMeters(PARIS, PARIS)).toBe(0);
    // Paris – Ushuaïa : environ 13 000 km (exemple de la spec, 3.5).
    expect(distanceMeters(PARIS, USHUAIA) / 1000).toBeGreaterThan(12_900);
    expect(distanceMeters(PARIS, USHUAIA) / 1000).toBeLessThan(13_300);
    // 0,001° de latitude ≈ 111 m.
    expect(distanceMeters(PARIS, { lat: PARIS.lat + 0.001, lng: PARIS.lng })).toBeCloseTo(111.2, 0);
  });
});

describe("destination et cap", () => {
  it("se correspondent", () => {
    for (const bearing of [0, 45, 90, 180, 270, 333]) {
      const point = destination(USHUAIA, bearing, 150);
      expect(distanceMeters(USHUAIA, point)).toBeCloseTo(150, 3);
      expect(bearingDegrees(USHUAIA, point)).toBeCloseTo(bearing, 1);
    }
  });

  it("traverse l'antiméridien", () => {
    const point = destination({ lat: 0, lng: 179.999 }, 90, 1000);
    expect(point.lng).toBeLessThan(-179);
    expect(normalizeLng(181)).toBeCloseTo(-179);
    expect(Math.abs(normalizeLng(-540))).toBeCloseTo(180);
  });
});

describe("clampToRadius : déplacement de 200 m au plus", () => {
  it("laisse un point à moins de 200 m", () => {
    const near = destination(PARIS, 30, 150);
    expect(clampToRadius(PARIS, near, 200)).toEqual(near);
  });

  it("ramène un point trop loin sur le cercle, dans la même direction", () => {
    for (const distance of [201, 250, 5_000, 2_000_000]) {
      const far = destination(PARIS, 120, distance);
      const clamped = clampToRadius(PARIS, far, 200);
      expect(distanceMeters(PARIS, clamped)).toBeLessThanOrEqual(200);
      expect(distanceMeters(PARIS, clamped)).toBeCloseTo(200 * RADIUS_SAFETY_RATIO, 3);
      expect(bearingDegrees(PARIS, clamped)).toBeCloseTo(120, 0);
    }
  });

  it("garde une marge sous 200 m pour l'écart sphère / ellipsoïde", () => {
    const edge = destination(USHUAIA, 0, 199.5);
    expect(distanceMeters(USHUAIA, clampToRadius(USHUAIA, edge, 200))).toBeCloseTo(198, 6);
  });
});

describe("divers", () => {
  it("valide les coordonnées", () => {
    expect(isValidLatLng(PARIS)).toBe(true);
    expect(isValidLatLng({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidLatLng({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidLatLng(null)).toBe(false);
  });

  it("dessine un cercle fermé de 200 m", () => {
    const ring = circlePolygon(PARIS, 200, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0][0]).toBeCloseTo(ring[32][0], 9);
    expect(ring[0][1]).toBeCloseTo(ring[32][1], 9);
    for (const [lng, lat] of ring) expect(distanceMeters(PARIS, { lat, lng })).toBeCloseTo(200, 3);
  });
});
