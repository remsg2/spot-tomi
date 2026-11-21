import { expect, test } from "@playwright/test";
import sharp from "sharp";

/** Icônes de l'app rendues à la demande dans la couleur de l'année en cours (--year). */

function hex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

async function pixel(buffer: Buffer, x: number, y: number) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return { color: hex(data[i], data[i + 1], data[i + 2]), alpha: data[i + 3], width: info.width, height: info.height };
}

test("icônes de l'app et favicon dans la couleur de l'année en cours", async ({ page, request }) => {
  await page.goto("/");
  const year = (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--year"))).trim().toUpperCase();
  expect(year).toMatch(/^#[0-9A-F]{6}$/);

  for (const [file, size] of [
    ["maskable-512.png", 512],
    ["maskable-192.png", 192],
    ["apple-touch-icon.png", 180],
    ["icon-512.png", 512],
  ] as const) {
    const response = await request.get(`/icons/${file}`);
    expect(response.status(), file).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    // Coin haut-gauche, à l'intérieur de l'arrondi : le fond du sticker, couleur de l'année.
    const top = await pixel(await response.body(), Math.round(size * 0.3), 3);
    expect([top.width, top.height], file).toEqual([size, size]);
    expect(top.color, file).toBe(year);
  }

  expect((await request.get("/icons/inconnue.png")).status()).toBe(404);

  const favicon = await request.get("/favicon.ico");
  expect(favicon.status()).toBe(200);
  const bytes = await favicon.body();
  expect([...bytes.subarray(0, 6)]).toEqual([0, 0, 1, 0, 3, 0]);
  // Première image (16 px, PNG) : fond de la couleur de l'année.
  const offset = bytes.readUInt32LE(6 + 12);
  const length = bytes.readUInt32LE(6 + 8);
  const first = await pixel(bytes.subarray(offset, offset + length), 8, 1);
  expect(first.color).toBe(year);
});
