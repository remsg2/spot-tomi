import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, homePoints, isolationPoints, toRules, ushuaiaExample } from "./rules";

describe("barème", () => {
  it("garde les valeurs par défaut sans données", () => {
    expect(toRules(null)).toEqual(DEFAULT_RULES);
  });

  it("applique les valeurs de la base (numeric renvoyé en texte) et ignore l'inconnu", () => {
    const rules = toRules([
      { key: "tier_rare", value: "75" },
      { key: "inconnu", value: 3 },
      { key: "bonus_altitude", value: "pas un nombre" },
    ]);
    expect(rules.tier_rare).toBe(75);
    expect(rules.bonus_altitude).toBe(DEFAULT_RULES.bonus_altitude);
    expect("inconnu" in rules).toBe(false);
  });

  it("isolement : +1 par 10 km entiers, plafonné", () => {
    expect(isolationPoints(9, DEFAULT_RULES)).toBe(0);
    expect(isolationPoints(59, DEFAULT_RULES)).toBe(5);
    expect(isolationPoints(1240, DEFAULT_RULES)).toBe(40);
  });

  it("domicile : +5 par 1 000 km entiers", () => {
    expect(homePoints(1400, DEFAULT_RULES)).toBe(5);
    expect(homePoints(13000, DEFAULT_RULES)).toBe(65);
  });

  it("l'exemple Ushuaïa donne 195 avec le barème par défaut (spec 3.5)", () => {
    expect(ushuaiaExample(DEFAULT_RULES).total).toBe(195);
  });
});
