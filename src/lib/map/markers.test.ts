import { expression, type ExpressionSpecification } from "@maplibre/maplibre-gl-style-spec";
import { describe, expect, it } from "vitest";
import {
  markerIconExpression,
  markerKey,
  markerLabel,
  markerSpec,
  parseMarkerKey,
  selectionRing,
} from "./markers";

/** Évalue une expression MapLibre comme le ferait la carte, pour un marqueur donné. */
function evaluate(expr: unknown, properties: Record<string, unknown>) {
  const compiled = expression.createExpression(expr as ExpressionSpecification, "layers[0].layout.icon-image");
  if (compiled.result !== "success") throw new Error(JSON.stringify(compiled.value));
  return compiled.value.evaluate({ zoom: 2 }, { type: "Point", properties } as never);
}

describe("taille et points des marqueurs", () => {
  it("26 px sous 20 points, 34 px de 20 à 79, 44 px dès 80", () => {
    expect(markerSpec({ points: 19, color: "#5B8DEF", gold: false, pending: false, theme: "light" }).size).toBe(26);
    expect(markerSpec({ points: 20, color: "#5B8DEF", gold: false, pending: false, theme: "light" }).size).toBe(34);
    expect(markerSpec({ points: 79, color: "#5B8DEF", gold: false, pending: false, theme: "light" }).size).toBe(34);
    expect(markerSpec({ points: 80, color: "#5B8DEF", gold: false, pending: false, theme: "light" }).size).toBe(44);
  });

  it("les points apparaissent dans la bande dès 34 px, jamais en attente", () => {
    expect(markerLabel(12, false)).toBe("");
    expect(markerLabel(53, false)).toBe("53");
    expect(markerLabel(195, true)).toBe("");
  });

  it("une couleur invalide retombe sur le gris des années sans couleur", () => {
    expect(markerSpec({ points: 5, color: "red", gold: false, pending: false, theme: "dark" }).color).toBe("#9A9A94");
  });

  it("l'anneau de sélection s'élargit autour d'un anneau doré", () => {
    expect(selectionRing(false)).toBe(4);
    expect(selectionRing(true)).toBe(6);
  });
});

describe("clés d'images des marqueurs", () => {
  const cases = [
    { points: 5, color: "#F2C230", gold: false, pending: false },
    { points: 53, color: "#5B8DEF", gold: true, pending: false },
    { points: 195, color: "#FF7A59", gold: true, pending: true },
    { points: 80, color: "#5DB043", gold: false, pending: false },
  ];

  it("une image par apparence : les petits marqueurs d'une même couleur partagent la leur", () => {
    const a = markerKey({ points: 3, color: "#F2C230", gold: false, pending: false, theme: "light" });
    const b = markerKey({ points: 17, color: "#F2C230", gold: false, pending: false, theme: "light" });
    expect(a).toBe(b);
    expect(a).toBe("m|26|#F2C230|0|0||0|light");
  });

  it("se relisent à l'identique", () => {
    for (const input of cases) {
      for (const selected of [false, true]) {
        const key = markerKey({ ...input, selected, theme: "dark" });
        expect(parseMarkerKey(key)).toEqual(markerSpec({ ...input, selected, theme: "dark" }));
      }
    }
    expect(parseMarkerKey("m|30|#000000|0|0||0|light")).toBeNull();
    expect(parseMarkerKey("c|3|12|light")).toBeNull();
  });

  it("l'expression MapLibre calcule la même clé que markerKey", () => {
    for (const input of cases) {
      for (const selected of [false, true]) {
        for (const theme of ["light", "dark"] as const) {
          expect(evaluate(markerIconExpression(theme, selected), { id: "x", ...input })).toBe(
            markerKey({ ...input, selected, theme }),
          );
        }
      }
    }
  });
});
