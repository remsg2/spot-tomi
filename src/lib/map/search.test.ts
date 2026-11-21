import { describe, expect, it } from "vitest";
import { flattenResults, groupResults, targetForResult } from "./search";
import type { SearchResult } from "./types";

const base: SearchResult = {
  kind: "spot",
  id: "1",
  label: "Ushuaïa",
  detail: null,
  lng: -68.3,
  lat: -54.8,
  bbox: null,
  color: "#FF7A59",
  points: 195,
  spot_count: null,
};

describe("résultats de recherche", () => {
  it("regroupe lieux, pays et personnes, dans cet ordre", () => {
    const rows: SearchResult[] = [
      { ...base, kind: "user", id: "u" },
      { ...base, kind: "country", id: "AR" },
      { ...base, kind: "spot", id: "s" },
    ];
    expect(flattenResults(groupResults(rows)).map((r) => r.id)).toEqual(["s", "AR", "u"]);
  });

  it("un lieu : on vole vers lui", () => {
    expect(targetForResult(base)).toEqual({ type: "fly", center: [-68.3, -54.8], zoom: 14 });
  });

  it("un pays : on cadre son emprise", () => {
    expect(
      targetForResult({ ...base, kind: "country", bbox: [-73.4, -55, -53.6, -21.8], lng: -64, lat: -34 }),
    ).toEqual({ type: "fit", bbox: [-73.4, -55, -53.6, -21.8] });
  });

  it("un pays à cheval sur l'antiméridien : on vise son point intérieur", () => {
    expect(
      targetForResult({ ...base, kind: "country", bbox: [-180, 41, 180, 82], lng: 99, lat: 62 }),
    ).toEqual({ type: "fly", center: [99, 62], zoom: 3.5 });
  });

  it("une personne avec un seul sticker : on vole vers lui", () => {
    expect(
      targetForResult({ ...base, kind: "user", bbox: [2.35, 48.87, 2.35, 48.87], lng: 2.35, lat: 48.87 }),
    ).toEqual({ type: "fly", center: [2.35, 48.87], zoom: 12 });
  });

  it("une personne sans sticker : rien à cadrer", () => {
    expect(targetForResult({ ...base, kind: "user", bbox: null, lng: null, lat: null })).toBeNull();
  });
});
