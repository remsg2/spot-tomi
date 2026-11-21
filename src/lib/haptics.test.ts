import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAPTICS_KEY, haptic, hapticsEnabled, setHapticsEnabled } from "./haptics";

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

describe("vibrations", () => {
  let vibrate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrate = vi.fn(() => true);
    vi.stubGlobal("window", { localStorage: fakeStorage(), setTimeout });
    vi.stubGlobal("navigator", { vibrate, userAgent: "Android", platform: "Linux", maxTouchPoints: 5 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("API Vibration (Android) : un motif par type de retour", () => {
    haptic("selection");
    haptic("tap");
    haptic("success");
    haptic("error");
    expect(vibrate.mock.calls.map(([pattern]) => pattern)).toEqual([
      8,
      14,
      [18, 70, 28, 70, 46],
      [45, 60, 45, 60, 45],
    ]);
  });

  it("désactivées dans les réglages : aucune vibration, préférence gardée sur l'appareil", () => {
    expect(hapticsEnabled()).toBe(true);
    setHapticsEnabled(false);
    expect(window.localStorage.getItem(HAPTICS_KEY)).toBe("off");
    haptic("success");
    expect(vibrate).not.toHaveBeenCalled();
    setHapticsEnabled(true);
    haptic("tap");
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("refus du navigateur (pas encore de geste) : sans erreur", () => {
    vibrate.mockImplementation(() => {
      throw new Error("not allowed");
    });
    expect(() => haptic("tap")).not.toThrow();
  });

  it("ordinateur sans vibration : rien", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (X11; Linux x86_64)", platform: "Linux x86_64", maxTouchPoints: 0 });
    expect(() => haptic("success")).not.toThrow();
  });
});
