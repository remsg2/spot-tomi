import { describe, expect, it } from "vitest";
import { focusFromPoint, focusPosition, nudgeFocus, sameFocus, toFocus } from "./focus";

describe("cadrage des photos", () => {
  it("lit le point de la base, sinon rien", () => {
    expect(toFocus(0.25, "0.8")).toEqual({ x: 0.25, y: 0.8 });
    expect(toFocus(null, null)).toBeNull();
    expect(toFocus(0.5, undefined)).toBeNull();
    expect(toFocus("abc", 0.2)).toBeNull();
    expect(toFocus(1.5, -1)).toEqual({ x: 1, y: 0 });
  });

  it("object-position : le point, sinon le centre", () => {
    expect(focusPosition(null)).toBe("50% 50%");
    expect(focusPosition({ x: 0.25, y: 0.8 })).toBe("25% 80%");
    expect(focusPosition({ x: 0.1234, y: 1 })).toBe("12.34% 100%");
  });

  it("point touché sur l'image entière, borné et arrondi au millième", () => {
    const rect = { left: 10, top: 20, width: 200, height: 400 };
    expect(focusFromPoint(rect, 60, 320)).toEqual({ x: 0.25, y: 0.75 });
    expect(focusFromPoint(rect, 0, 1000)).toEqual({ x: 0, y: 1 });
    expect(focusFromPoint(rect, 76.66, 20)).toEqual({ x: 0.333, y: 0 });
    expect(focusFromPoint({ left: 0, top: 0, width: 0, height: 0 }, 1, 1)).toBeNull();
  });

  it("flèches du clavier : 2 %, 10 % avec Maj, depuis le centre si aucun point", () => {
    expect(nudgeFocus(null, "ArrowRight")).toEqual({ x: 0.52, y: 0.5 });
    expect(nudgeFocus({ x: 0.5, y: 0.05 }, "ArrowUp", true)).toEqual({ x: 0.5, y: 0 });
    expect(nudgeFocus({ x: 0.2, y: 0.2 }, "Enter")).toBeNull();
  });

  it("compare deux points", () => {
    expect(sameFocus(null, null)).toBe(true);
    expect(sameFocus({ x: 0.1, y: 0.2 }, { x: 0.1004, y: 0.2 })).toBe(true);
    expect(sameFocus({ x: 0.1, y: 0.2 }, null)).toBe(false);
  });
});
