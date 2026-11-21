import { describe, expect, it } from "vitest";
import { POINT_RULE_KEYS, type SpotPointLineRow } from "@/lib/types/database";
import { toPointLines } from "./lines";

const spotId = "5b000000-0000-4000-8000-000000000014";

// Doublon d'un lieu très rare, tel que l'écrit compute_spot_points (cahier des charges V1.1).
const summit: SpotPointLineRow[] = [
  { spot_id: spotId, rule_key: "duplicate", position: 3, label: "Sticker voisin", detail: "Un autre sticker est à moins de 200 m : pas de bonus de rareté", points: -200 },
  { spot_id: spotId, rule_key: "base", position: 1, label: "Sticker publié", detail: "Points de base", points: 100 },
  { spot_id: spotId, rule_key: "rarity", position: 2, label: "Lieu très rare", detail: "4 300 m d'altitude", points: 200 },
];

describe("toPointLines", () => {
  it("trie par position et garde libellés, détails et points", () => {
    const lines = toPointLines(summit);
    expect(lines.map((line) => line.key)).toEqual(["base", "rarity", "duplicate"]);
    expect(lines.reduce((sum, line) => sum + line.points, 0)).toBe(100);
    expect(lines[1]).toMatchObject({ label: "Lieu très rare", detail: "4 300 m d'altitude" });
  });

  it("affiche la base sans « + » et choisit la puce de chaque critère", () => {
    const lines = toPointLines(summit);
    expect(lines.filter((line) => line.isBase).map((line) => line.key)).toEqual(["base"]);
    expect(lines.map((line) => line.tone)).toEqual(["base", "year", "base"]);
  });

  it("lit encore un détail figé avec l'ancien barème", () => {
    const lines = toPointLines([
      { spot_id: spotId, rule_key: "first_country", position: 2, label: "Premier sticker du pays", detail: null, points: 50 },
      { spot_id: spotId, rule_key: "base_country", position: 1, label: "Pays courant", detail: "France, points de base", points: 10 },
    ]);
    expect(lines.map((line) => [line.key, line.isBase, line.tone])).toEqual([
      ["base_country", true, "base"],
      ["first_country", false, "gold"],
    ]);
    expect(lines[1].detail).toBeUndefined();
  });

  it("ne modifie pas le tableau reçu", () => {
    const rows = [...summit];
    toPointLines(rows);
    expect(rows).toEqual(summit);
  });
});

describe("POINT_RULE_KEYS", () => {
  it("liste les 3 critères écrits par compute_spot_points", () => {
    expect(POINT_RULE_KEYS).toEqual(["base", "rarity", "duplicate"]);
  });
});
