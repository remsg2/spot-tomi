import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

/**
 * Icônes de l'app dans la couleur de l'année en cours (current_season) :
 * le sticker de Tomi (carré de la couleur, Tomi détouré, bande noire en
 * diagonale), rendu à la demande par les routes /icons/[file] et /favicon.ico.
 * Quand l'admin change la couleur de l'année, les icônes suivent.
 *
 * Les images sources (public/tomi) sont jointes aux fonctions serveur par
 * outputFileTracingIncludes (next.config.ts).
 */

const BAND = "#111111";

type Art = "tomi" | "head";
type IconSpec = { size: number; radius: number; inset: number; art: Art };

/** Fichiers servis sous /icons/ (manifeste, iOS, favicon PNG). */
export const ICON_FILES = {
  "icon-192.png": { size: 192, radius: 35, inset: 0, art: "tomi" },
  "icon-512.png": { size: 512, radius: 92, inset: 0, art: "tomi" },
  // Pleine page : Android découpe lui-même la forme (zone sûre de 10 %).
  "maskable-192.png": { size: 192, radius: 0, inset: 19, art: "tomi" },
  "maskable-512.png": { size: 512, radius: 0, inset: 51, art: "tomi" },
  // Opaque et carrée : iOS arrondit lui-même.
  "apple-touch-icon.png": { size: 180, radius: 0, inset: 0, art: "tomi" },
  // Petite taille : la tête de Tomi, lisible.
  "favicon-64.png": { size: 64, radius: 13, inset: 0, art: "head" },
} satisfies Record<string, IconSpec>;

export type IconFile = keyof typeof ICON_FILES;

export function isIconFile(name: string): name is IconFile {
  return Object.hasOwn(ICON_FILES, name);
}

const ART_FILES: Record<Art, string> = { tomi: "public/tomi/tomi.png", head: "public/tomi/tomi-head.png" };
const artCache = new Map<Art, Promise<string>>();

function artBase64(art: Art): Promise<string> {
  let cached = artCache.get(art);
  if (!cached) {
    cached = readFile(join(process.cwd(), ART_FILES[art])).then((buffer) => buffer.toString("base64"));
    artCache.set(art, cached);
  }
  return cached;
}

/** SVG du sticker : `inset` réserve une marge, `radius` arrondit les coins. */
export function stickerSvg({
  size,
  color,
  art,
  radius,
  inset,
}: {
  size: number;
  color: string;
  art: string;
  radius: number;
  inset: number;
}): string {
  const inner = size - inset * 2;
  // La bande (95 % → 64 % de la hauteur de Tomi) va toujours jusqu'aux bords.
  const band = [
    [0, inset + 0.95 * inner],
    [size, inset + 0.64 * inner],
    [size, size],
    [0, size],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><clipPath id="c"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="${size}" height="${size}" fill="${color}"/>
    <image x="${inset}" y="${inset}" width="${inner}" height="${inner}" preserveAspectRatio="xMidYMid slice" xlink:href="data:image/png;base64,${art}"/>
    <polygon points="${band}" fill="${BAND}"/>
  </g>
</svg>`;
}

/** Fichier .ico contenant des images PNG (format accepté par tous les navigateurs). */
export function ico(images: { size: number; data: Buffer }[]): Buffer {
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

async function renderSpec(spec: IconSpec, color: string): Promise<Buffer> {
  const svg = stickerSvg({ ...spec, color, art: await artBase64(spec.art) });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** Images déjà rendues, par fichier et couleur (quelques couleurs au plus). */
const rendered = new Map<string, Promise<Buffer>>();

function memo(key: string, render: () => Promise<Buffer>): Promise<Buffer> {
  let image = rendered.get(key);
  if (!image) {
    image = render().catch((error: unknown) => {
      rendered.delete(key);
      throw error;
    });
    if (rendered.size > 40) rendered.clear();
    rendered.set(key, image);
  }
  return image;
}

export function renderIcon(file: IconFile, color: string): Promise<Buffer> {
  return memo(`${file}|${color}`, () => renderSpec(ICON_FILES[file], color));
}

/** favicon.ico : la tête de Tomi en 16, 32 et 48 px. */
export function renderFavicon(color: string): Promise<Buffer> {
  return memo(`favicon.ico|${color}`, async () => {
    const images = await Promise.all(
      [16, 32, 48].map(async (size) => ({
        size,
        data: await renderSpec({ size, radius: Math.max(2, Math.round(size * 0.2)), inset: 0, art: "head" }, color),
      })),
    );
    return ico(images);
  });
}

/**
 * Les navigateurs gardent l'icône une heure, le CDN dix minutes : une nouvelle
 * couleur d'année est servie partout en moins d'une heure.
 */
export const ICON_CACHE_CONTROL = "public, max-age=3600, s-maxage=600, stale-while-revalidate=86400";
