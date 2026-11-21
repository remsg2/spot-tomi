import { describe, expect, it } from "vitest";
import { toPointLines } from "./lines";

describe("détail des points de la fiche", () => {
  it("ordonne les lignes et choisit la puce de chacune", () => {
    const lines = toPointLines([
      { rule_key: "bonus_first_city", position: 3, label: "Première ville", detail: "Ushuaïa", points: 15 },
      { rule_key: "base_country", position: 1, label: "Pays lointain", detail: "Argentine, points de base", points: 25 },
      { rule_key: "bonus_first_country", position: 2, label: "Premier sticker du pays", detail: null, points: 50 },
      { rule_key: "bonus_exceptional", position: 4, label: "Lieu exceptionnel", detail: null, points: 20 },
      { rule_key: "neighbor_malus", position: 9, label: "Voisin à moins de 200 m", detail: null, points: -83 },
    ]);
    expect(lines.map((l) => [l.key, l.tone, l.isBase])).toEqual([
      ["base_country", "base", true],
      ["bonus_first_country", "gold", false],
      ["bonus_first_city", "year", false],
      ["bonus_exceptional", "gold", false],
      ["neighbor_malus", "year", false],
    ]);
    expect(lines[1].detail).toBeUndefined();
    expect(lines[4].points).toBe(-83);
  });
});
