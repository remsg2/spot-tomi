import { describe, expect, it } from "vitest";
import { POINT_RULE_KEYS, type SpotPointLineRow } from "@/lib/types/database";
import { toPointLines } from "./lines";

const spotId = "5b000000-0000-4000-8000-000000000014";

// Exemple Ushuaïa de la spec (3.5), tel que l'écrit compute_spot_points.
const ushuaia: SpotPointLineRow[] = [
  { spot_id: spotId, rule_key: "home_distance", position: 5, label: "Loin de chez toi", detail: "13 200 km, +5 par 1 000 km", points: 65 },
  { spot_id: spotId, rule_key: "base_country", position: 1, label: "Pays lointain", detail: "Argentine, points de base", points: 25 },
  { spot_id: spotId, rule_key: "first_country", position: 2, label: "Premier sticker du pays", detail: "Personne avant toi dans ce pays", points: 50 },
  { spot_id: spotId, rule_key: "first_city", position: 3, label: "Première ville", detail: "Ushuaïa", points: 15 },
  { spot_id: spotId, rule_key: "isolation", position: 4, label: "Isolement", detail: null, points: 40 },
];

describe("toPointLines", () => {
  it("trie par position et garde libellés, détails et points", () => {
    const lines = toPointLines(ushuaia);
    expect(lines.map((line) => line.key)).toEqual([
      "base_country",
      "first_country",
      "first_city",
      "isolation",
      "home_distance",
    ]);
    expect(lines.reduce((sum, line) => sum + line.points, 0)).toBe(195);
    expect(lines[0]).toMatchObject({ label: "Pays lointain", detail: "Argentine, points de base" });
    expect(lines[3].detail).toBeUndefined();
  });

  it("affiche la base sans « + » et choisit la puce de chaque critère", () => {
    const lines = toPointLines(ushuaia);
    expect(lines.filter((line) => line.isBase).map((line) => line.key)).toEqual(["base_country"]);
    expect(lines.map((line) => line.tone)).toEqual(["base", "gold", "year", "year", "year"]);
  });

  it("garde le malus voisin en négatif", () => {
    const lines = toPointLines([
      { spot_id: spotId, rule_key: "neighbor_malus", position: 2, label: "Sticker voisin", detail: "Autre sticker à moins de 200 m, total divisé par 4", points: -8 },
      { spot_id: spotId, rule_key: "base_country", position: 1, label: "Pays courant", detail: "France, points de base", points: 10 },
    ]);
    expect(lines.map((line) => line.points)).toEqual([10, -8]);
    expect(lines[1].tone).toBe("base");
  });

  it("ne modifie pas le tableau reçu", () => {
    const rows = [...ushuaia];
    toPointLines(rows);
    expect(rows).toEqual(ushuaia);
  });
});

describe("POINT_RULE_KEYS", () => {
  it("liste les 8 critères écrits par compute_spot_points", () => {
    expect(POINT_RULE_KEYS).toHaveLength(8);
    expect(new Set(POINT_RULE_KEYS).size).toBe(8);
  });
});
