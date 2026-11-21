import { expression, type ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import {
  CLUSTER_FALLBACK,
  clusterCountLabel,
  clusterIconExpression,
  clusterKeyFromProperties,
  clusterProperties,
  clusterSlots,
  parseClusterKey,
  sameSlots,
  slotProperty,
} from "./clusters";
import type { SpotCollection } from "./types";

function evaluate(expr: unknown, properties: Record<string, unknown>) {
  const compiled = expression.createExpression(expr as ExpressionSpecification, "layers[0].layout.icon-image");
  if (compiled.result !== "success") throw new Error(JSON.stringify(compiled.value));
  return compiled.value.evaluate({ zoom: 2 }, { type: "Point", properties } as never);
}

const SEASONS = [
  { year: 2026, color_hex: "#5B8DEF", is_current: true },
  { year: 2024, color_hex: "#F2C230", is_current: false },
  { year: 2025, color_hex: "#FF7A59", is_current: false },
];

function collection(colors: string[]): SpotCollection {
  return {
    type: "FeatureCollection",
    features: colors.map((color, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [i, i] },
      properties: { id: `s${i}`, color, points: 10, gold: false, pending: false },
    })),
  };
}

/** Regroupe des stickers comme la source GeoJSON de MapLibre (map puis « + »). */
function aggregate(slots: string[], colors: string[]): Record<string, unknown> {
  const props = clusterProperties(slots);
  const result: Record<string, unknown> = { point_count: colors.length, cluster: true };
  for (const [name, [operator, map]] of Object.entries(props) as [string, [string, unknown]][]) {
    expect(operator).toBe("+");
    result[name] = colors.reduce((sum, color) => sum + Number(evaluate(map, { color })), 0);
  }
  return result;
}

describe("créneaux d'années des groupes", () => {
  it("dans l'ordre des années, puis les couleurs des données hors saison", () => {
    const data = collection(["#5B8DEF", "#123456", "#F2C230", "#123456", "rouge"]);
    expect(clusterSlots(SEASONS, data)).toEqual(["#F2C230", "#FF7A59", "#5B8DEF", "#123456"]);
  });

  it("sans saisons : les couleurs des données suffisent", () => {
    expect(clusterSlots([], collection(["#FF7A59", "#5B8DEF", "#FF7A59"]))).toEqual(["#FF7A59", "#5B8DEF"]);
  });

  it("détecte un changement de créneaux", () => {
    expect(sameSlots(["#F2C230", "#5B8DEF"], ["#F2C230", "#5B8DEF"])).toBe(true);
    expect(sameSlots(["#F2C230", "#5B8DEF"], ["#5B8DEF", "#F2C230"])).toBe(false);
    expect(sameSlots(["#F2C230"], ["#F2C230", "#5B8DEF"])).toBe(false);
  });
});

describe("groupes : bulle avec les années présentes et le total", () => {
  const slots = clusterSlots(SEASONS, collection([]));

  it("compte les stickers de chaque année (pour savoir lesquelles sont présentes)", () => {
    const props = aggregate(slots, ["#5B8DEF", "#F2C230", "#5B8DEF", "#5B8DEF"]);
    expect(props[slotProperty(0)]).toBe(1); // 2024
    expect(props[slotProperty(1)]).toBe(0); // 2025
    expect(props[slotProperty(2)]).toBe(3); // 2026
    expect(props).not.toHaveProperty("points");
  });

  it("l'expression MapLibre calcule la même clé que clusterKeyFromProperties", () => {
    for (const colors of [
      ["#5B8DEF", "#5B8DEF"],
      ["#F2C230", "#FF7A59", "#5B8DEF", "#5B8DEF"],
      ["#FF7A59", "#9A9A94", "#FF7A59"],
    ]) {
      const props = aggregate(slots, colors);
      for (const theme of ["light", "dark"] as const) {
        expect(evaluate(clusterIconExpression(slots, theme), props)).toBe(
          clusterKeyFromProperties(slots, props, theme),
        );
      }
    }
  });

  it("clé : total et couleurs des années présentes, la plus ancienne d'abord, sans détail par année", () => {
    const props = aggregate(slots, ["#5B8DEF", "#F2C230", "#5B8DEF"]);
    const key = clusterKeyFromProperties(slots, props, "light");
    expect(key).toBe("c|light|3|#F2C230|#5B8DEF");
    expect(parseClusterKey(key)).toEqual({ theme: "light", total: 3, colors: ["#F2C230", "#5B8DEF"] });
  });

  it("même image pour deux groupes de même total et mêmes années", () => {
    const a = aggregate(slots, ["#5B8DEF", "#F2C230", "#5B8DEF"]);
    const b = aggregate(slots, ["#F2C230", "#F2C230", "#5B8DEF"]);
    expect(clusterKeyFromProperties(slots, a, "dark")).toBe(clusterKeyFromProperties(slots, b, "dark"));
  });

  it("sans année reconnue : un sticker gris", () => {
    const props = aggregate(slots, ["#ABCDEF", "#ABCDEF"]);
    expect(parseClusterKey(clusterKeyFromProperties(slots, props, "dark"))).toEqual({
      theme: "dark",
      total: 2,
      colors: [CLUSTER_FALLBACK],
    });
  });

  it("refuse les clés qui ne sont pas des groupes", () => {
    expect(parseClusterKey("m|26|#F2C230|0|0||0|light")).toBeNull();
    expect(parseClusterKey("c|light|0")).toBeNull();
    expect(parseClusterKey("c|sepia|3|#F2C230")).toBeNull();
    expect(parseClusterKey("c|light|3|rouge")).toBeNull();
  });
});

describe("total de la bulle", () => {
  it("en français, abrégé dès 10 000", () => {
    expect(clusterCountLabel(7)).toBe("7");
    expect(clusterCountLabel(4829).replace(/\s/g, " ")).toBe("4 829");
    expect(clusterCountLabel(12_400)).toBe("12k");
  });
});
