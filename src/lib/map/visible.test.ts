import { describe, expect, it } from "vitest";
import type { SpotFeature } from "./types";
import { summarizeVisible } from "./visible";

function feature(id: string, lng: number, lat: number, points: number, pending = false): SpotFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: { id, color: "#5B8DEF", points, gold: false, pending },
  };
}

describe("stickers à l'écran", () => {
  const features = [
    feature("paris", 2.35, 48.85, 12),
    feature("lyon", 4.83, 45.76, 40, true),
    feature("ushuaia", -68.3, -54.8, 195),
    feature("fidji-est", 179.9, -16.8, 30),
    feature("fidji-ouest", -179.9, -16.8, 31),
  ];

  it("compte les stickers et leurs points dans la vue (sans les points en attente)", () => {
    const summary = summarizeVisible(features, { min_lng: -5, min_lat: 42, max_lng: 8, max_lat: 51 });
    expect(summary.count).toBe(2);
    expect(summary.points).toBe(12);
    expect(summary.top.map((s) => s.id)).toEqual(["lyon", "paris"]);
  });

  it("gère une vue à cheval sur l'antiméridien", () => {
    const summary = summarizeVisible(features, { min_lng: 170, min_lat: -20, max_lng: -170, max_lat: -10 });
    expect(summary.top.map((s) => s.id)).toEqual(["fidji-ouest", "fidji-est"]);
  });

  it("limite la liste aux plus forts en points", () => {
    const world = { min_lng: -180, min_lat: -90, max_lng: 180, max_lat: 90 };
    expect(summarizeVisible(features, world, 2).top.map((s) => s.id)).toEqual(["ushuaia", "lyon"]);
  });
});
