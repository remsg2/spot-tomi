import { expression, type ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import {
  CLUSTER_FALLBACK,
  clusterCountLabel,
  clusterIconExpression,
  clusterKeyFromProperties,
  clusterProperties,
  clusterSlots,
  clusterTileSize,
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

describe("groupes par année", () => {
  const slots = clusterSlots(SEASONS, collection([]));

  it("compte les stickers de chaque année sans jamais les additionner entre elles", () => {
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

  it("clé lisible : une année par sticker, la plus ancienne d'abord", () => {
    const props = aggregate(slots, ["#5B8DEF", "#F2C230", "#5B8DEF"]);
    const key = clusterKeyFromProperties(slots, props, "light");
    expect(key).toBe("c|light|3|#F2C230:1|#5B8DEF:2");
    expect(parseClusterKey(key)).toEqual({
      theme: "light",
      groups: [
        { color: "#F2C230", count: 1 },
        { color: "#5B8DEF", count: 2 },
      ],
    });
  });

  it("les stickers d'une année sans créneau forment un groupe gris", () => {
    const props = aggregate(slots, ["#5B8DEF", "#ABCDEF", "#ABCDEF"]);
    expect(parseClusterKey(clusterKeyFromProperties(slots, props, "dark"))).toEqual({
      theme: "dark",
      groups: [
        { color: "#5B8DEF", count: 1 },
        { color: CLUSTER_FALLBACK, count: 2 },
      ],
    });
  });

  it("refuse les clés qui ne sont pas des groupes", () => {
    expect(parseClusterKey("m|26|#F2C230|0|0||0|light")).toBeNull();
    expect(parseClusterKey("c|light|0")).toBeNull();
    expect(parseClusterKey("c|sepia|3|#F2C230:3")).toBeNull();
    expect(parseClusterKey("c|light|3|rouge:3")).toBeNull();
  });
});

describe("dessin des groupes", () => {
  it("nombre de stickers écrit en entier, abrégé dès 10 000", () => {
    expect(clusterCountLabel(7)).toBe("7");
    expect(clusterCountLabel(4829)).toBe("4829");
    expect(clusterCountLabel(12_400)).toBe("12k");
  });

  it("le sticker d'une année grandit avec son nombre de stickers", () => {
    expect(clusterTileSize(2)).toBe(34);
    expect(clusterTileSize(10)).toBe(40);
    expect(clusterTileSize(99)).toBe(40);
    expect(clusterTileSize(100)).toBe(46);
  });
});
