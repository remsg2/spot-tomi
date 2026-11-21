import { describe, expect, it } from "vitest";
import { dHashFromGray, grayscale, hammingDistance, HASH_HEIGHT, HASH_WIDTH } from "./photo-hash";

const gradient = (direction: 1 | -1) =>
  Array.from({ length: HASH_WIDTH * HASH_HEIGHT }, (_, i) => 128 + direction * ((i % HASH_WIDTH) * 10));

describe("dHashFromGray", () => {
  it("un dégradé qui fonce vers la droite donne tous les bits à 1 (-1 en entier signé)", () => {
    expect(dHashFromGray(gradient(-1))).toBe(BigInt(-1));
  });

  it("un dégradé qui s'éclaircit vers la droite donne 0", () => {
    expect(dHashFromGray(gradient(1))).toBe(BigInt(0));
  });

  it("refuse une image qui n'est pas en 9 × 8", () => {
    expect(() => dHashFromGray([1, 2, 3])).toThrow();
  });

  it("une légère retouche ne change que quelques bits", () => {
    const base = Array.from({ length: 72 }, (_, i) => (i * 37) % 255);
    const retouched = base.map((value, i) => (i === 10 ? value + 60 : value));
    expect(hammingDistance(dHashFromGray(base), dHashFromGray(retouched))).toBeLessThanOrEqual(2);
  });
});

describe("hammingDistance", () => {
  it("compte les bits différents, signe compris", () => {
    expect(hammingDistance(BigInt(0), BigInt(0))).toBe(0);
    expect(hammingDistance(BigInt(0), BigInt(7))).toBe(3);
    expect(hammingDistance(BigInt(0), BigInt(-1))).toBe(64);
  });
});

describe("grayscale", () => {
  it("convertit RGBA en luminance", () => {
    expect(grayscale([255, 255, 255, 255, 0, 0, 0, 255])).toEqual([255, 0]);
  });
});
