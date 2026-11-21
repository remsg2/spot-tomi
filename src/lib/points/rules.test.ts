import { describe, expect, it } from "vitest";
import { categoryBonus, DEFAULT_RULES, isolatedExample, spotPoints, toRules } from "./rules";

describe("barème", () => {
  it("garde les valeurs par défaut sans données", () => {
    expect(toRules(null)).toEqual(DEFAULT_RULES);
  });

  it("applique les valeurs de la base (numeric renvoyé en texte) et ignore l'inconnu", () => {
    const rules = toRules([
      { key: "bonus_isole", value: "120" },
      { key: "inconnu", value: 3 },
      { key: "base_points", value: "pas un nombre" },
    ]);
    expect(rules.bonus_isole).toBe(120);
    expect(rules.base_points).toBe(DEFAULT_RULES.base_points);
    expect("inconnu" in rules).toBe(false);
  });

  it("bonus de rareté du cahier des charges : 0, 20, 50, 100, 200", () => {
    expect(
      (["courant", "touristique", "remarquable", "isole", "tres_rare"] as const).map((category) =>
        categoryBonus(category, DEFAULT_RULES),
      ),
    ).toEqual([0, 20, 50, 100, 200]);
  });

  it("100 points de base, pas de bonus pour un doublon", () => {
    expect(spotPoints("tres_rare", false, DEFAULT_RULES)).toBe(300);
    expect(spotPoints("tres_rare", true, DEFAULT_RULES)).toBe(100);
    expect(spotPoints("courant", false, DEFAULT_RULES)).toBe(100);
  });

  it("l'exemple d'un lieu isolé donne 200 avec le barème par défaut", () => {
    expect(isolatedExample(DEFAULT_RULES).total).toBe(200);
  });
});
