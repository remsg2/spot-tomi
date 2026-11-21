#!/usr/bin/env node
/**
 * Génère les icônes de la PWA à partir de public/tomi/tomi.png : le sticker de
 * Tomi (carré de la couleur de l'année, Tomi détouré, bande noire en diagonale).
 *
 * Usage : node scripts/generate-icons.mjs [--color #RRGGBB]
 * Par défaut : couleur de la saison courante des données d'exemple (2026).
 * À relancer quand le détouré HD de Tomi ou la couleur de référence changent.
 *
 * Sorties (public/icons/) :
 * - icon-192.png, icon-512.png : sticker aux coins arrondis, fond transparent ;
 * - maskable-192.png, maskable-512.png : pleine page (Android découpe la forme) ;
 * - apple-touch-icon.png (180 px) : opaque, iOS arrondit lui-même.
 *
 * Et dans src/app/ (conventions de fichiers Next) :
 * - favicon.ico (16, 32, 48 px) et icon.png (64 px) : la tête de Tomi
 *   (public/tomi/tomi-head.png), lisible à toute petite taille.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "public/tomi/tomi.png");
const HEAD_SOURCE = join(ROOT, "public/tomi/tomi-head.png");
const OUT_DIR = join(ROOT, "public/icons");
const APP_DIR = join(ROOT, "src/app");
const BAND = "#111111";

function parseColor(argv) {
  const index = argv.indexOf("--color");
  const color = index >= 0 ? argv[index + 1] : "#5B8DEF";
  if (!/^#[0-9A-Fa-f]{6}$/.test(color ?? "")) {
    throw new Error(`Couleur invalide : ${color} (attendu #RRGGBB)`);
  }
  return color;
}

/**
 * SVG du sticker. `inset` réserve une marge (zone sûre des icônes masquables),
 * `radius` arrondit les coins (0 pour une icône pleine page).
 */
function stickerSvg({ size, color, tomi, radius, inset }) {
  const art = size - inset * 2;
  // Tomi occupe tout le carré comme dans le composant Sticker (object-cover) ;
  // la bande (95 % → 64 %) va toujours jusqu'aux bords de l'icône.
  const band = [
    [0, inset + 0.95 * art],
    [size, inset + 0.64 * art],
    [size, size],
    [0, size],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><clipPath id="c"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="${size}" height="${size}" fill="${color}"/>
    <image x="${inset}" y="${inset}" width="${art}" height="${art}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/png;base64,${tomi}"/>
    <polygon points="${band}" fill="${BAND}"/>
  </g>
</svg>`;
}

async function render(name, options) {
  const output = join(OUT_DIR, name);
  await sharp(Buffer.from(stickerSvg(options)))
    .png({ compressionLevel: 9, palette: false })
    .toFile(output);
  console.log(`  ${name}`);
}

/** PNG en mémoire du sticker « tête de Tomi » pour le favicon. */
function headPng(size, color, head) {
  const radius = Math.max(2, Math.round(size * 0.2));
  const svg = stickerSvg({ size, color, tomi: head, radius, inset: 0 });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** Fichier .ico contenant des images PNG (format accepté par tous les navigateurs). */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(0, 0); // réservé
  header.writeUInt16LE(1, 2); // type : icône
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, entry); // largeur
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1); // hauteur
    header.writeUInt8(0, entry + 2); // palette
    header.writeUInt8(0, entry + 3); // réservé
    header.writeUInt16LE(1, entry + 4); // plans
    header.writeUInt16LE(32, entry + 6); // bits par pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

async function main() {
  const color = parseColor(process.argv.slice(2));
  const tomi = readFileSync(SOURCE).toString("base64");
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Icônes générées (${color}) :`);
  for (const size of [192, 512]) {
    await render(`icon-${size}.png`, { size, color, tomi, radius: Math.round(size * 0.18), inset: 0 });
    await render(`maskable-${size}.png`, { size, color, tomi, radius: 0, inset: Math.round(size * 0.1) });
  }
  await render("apple-touch-icon.png", { size: 180, color, tomi, radius: 0, inset: 0 });

  const head = readFileSync(HEAD_SOURCE).toString("base64");
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map(async (size) => ({ size, data: await headPng(size, color, head) })));
  writeFileSync(join(APP_DIR, "favicon.ico"), ico(images));
  writeFileSync(join(APP_DIR, "icon.png"), await headPng(64, color, head));
  console.log("  src/app/favicon.ico (16, 32, 48), src/app/icon.png (64)");
}

await main();
