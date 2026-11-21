/**
 * Dessin des images de marqueurs et de groupes, une fois par apparence, pour
 * MapLibre (map.addImage). Reprend fidèlement MapMarker et ClusterStack
 * (src/components/ui) : 5 000 stickers deviennent quelques dizaines d'images
 * partagées, rendues par le GPU, au lieu de 5 000 éléments DOM.
 */
import { clusterCountLabel, clusterTileSize, clusterTileTilt, type ClusterSpec } from "@/lib/map/clusters";
import { MARKER_PADDING, markerFontSize, markerRadius, selectionRing, type MarkerSpec } from "@/lib/map/markers";
import { MAP_COLORS } from "@/lib/map/style";
import type { ThemeName } from "@/lib/map/types";

const BAND = "#111111";
const GOLD = "#E9B52F";

export type MarkerAssets = {
  /** Tête de Tomi (public/tomi/tomi-head.png), déjà décodée. */
  head: HTMLImageElement;
  displayFont: string;
  sansFont: string;
  /** Couleur de l'année en cours (rareté des pays). */
  yearColor: string;
};

export type DrawnImage = { data: ImageData; pixelRatio: number };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function createCanvas(width: number, height: number, ratio: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D indisponible");
  ctx.scale(ratio, ratio);
  return { canvas, ctx };
}

/** Lit les familles de polices de next/font et la couleur de l'année sur <html>. */
export async function loadMarkerAssets(): Promise<MarkerAssets> {
  const styles = getComputedStyle(document.documentElement);
  const displayFont = styles.getPropertyValue("--font-archivo-black").trim() || "sans-serif";
  const sansFont = styles.getPropertyValue("--font-inter").trim() || "sans-serif";
  const yearColor = styles.getPropertyValue("--year").trim() || "#9A9A94";

  const head = new Image();
  head.decoding = "async";
  head.src = "/tomi/tomi-head.png";
  await Promise.all([
    head.decode().catch(() => undefined),
    document.fonts?.load(`16px ${displayFont}`).catch(() => undefined),
    document.fonts?.load(`700 12px ${sansFont}`).catch(() => undefined),
  ]);
  return { head, displayFont, sansFont, yearColor };
}

const DEG = Math.PI / 180;

/**
 * Sticker de Tomi centré sur l'origine (déjà tourné par l'appelant) : ombre,
 * bord, couleur de l'année, tête de Tomi et bande noire (0 96 %, 100 % 62 %).
 * Renvoie le carré intérieur, pour écrire dans la bande.
 */
function drawStickerFace(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
  assets: MarkerAssets,
  theme: ThemeName,
  ratio: number,
): { x0: number; y0: number; inner: number } {
  const half = size / 2;
  const r = markerRadius(size);

  // Ombre portée et bord (2 px) du sticker.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 6 * ratio;
  ctx.shadowOffsetY = 2 * ratio;
  roundRect(ctx, -half, -half, size, size, r);
  ctx.fillStyle = MAP_COLORS[theme].edge;
  ctx.fill();
  ctx.restore();

  const inner = size - 4;
  const x0 = -half + 2;
  const y0 = -half + 2;
  ctx.save();
  roundRect(ctx, x0, y0, inner, inner, Math.max(0, r - 2));
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x0, y0, inner, inner);
  if (assets.head.complete && assets.head.naturalWidth > 0) {
    ctx.drawImage(assets.head, x0 + inner * 0.06, y0 + inner * 0.1, inner * 0.94, inner * 0.94);
  }
  ctx.beginPath();
  ctx.moveTo(x0, y0 + inner * 0.96);
  ctx.lineTo(x0 + inner, y0 + inner * 0.62);
  ctx.lineTo(x0 + inner, y0 + inner);
  ctx.lineTo(x0, y0 + inner);
  ctx.closePath();
  ctx.fillStyle = BAND;
  ctx.fill();
  ctx.restore();
  return { x0, y0, inner };
}

/** Mini-sticker : carré de la couleur de l'année, bord, Tomi, bande et points. */
export function drawMarker(spec: MarkerSpec, assets: MarkerAssets, ratio: number): DrawnImage {
  const s = spec.size;
  const box = s + MARKER_PADDING * 2;
  const { canvas, ctx } = createCanvas(box, box, ratio);
  const colors = MAP_COLORS[spec.theme];
  const half = s / 2;
  const r = markerRadius(s);

  ctx.translate(box / 2, box / 2);
  ctx.rotate(-5 * DEG);

  if (spec.selected) {
    const w = selectionRing(spec.gold);
    roundRect(ctx, -half - w, -half - w, s + w * 2, s + w * 2, r + w);
    ctx.fillStyle = colors.ring;
    ctx.fill();
  }

  if (spec.gold) {
    ctx.save();
    ctx.shadowColor = "rgba(233, 181, 47, 0.75)";
    ctx.shadowBlur = 12 * ratio;
    roundRect(ctx, -half - 2, -half - 2, s + 4, s + 4, r + 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.restore();
  }

  const { x0, y0, inner } = drawStickerFace(ctx, s, spec.color, assets, spec.theme, ratio);
  if (spec.label) {
    ctx.fillStyle = spec.color;
    ctx.font = `${markerFontSize(s)}px ${assets.displayFont}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(spec.label, x0 + inner - 2, y0 + inner - 2);
  }

  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: ratio };
}

/** Pastille du nombre de stickers, sous le sticker de chaque année. */
const COUNT_HEIGHT = 18;
const COUNT_FONT_SIZE = 11;
/** Décalage de la carte du dessous, qui donne l'effet de pile. */
const STACK_OFFSET = { x: 4, y: -4, tilt: 9 };
const CLUSTER_PADDING = 10;

/**
 * Groupe de stickers : une rangée d'une pile par année présente (la plus
 * ancienne à gauche), chaque pile du sticker de Tomi de son année avec son
 * nombre de stickers dans une pastille noire. Les années ne se mélangent jamais.
 */
export function drawCluster(spec: ClusterSpec, assets: MarkerAssets, ratio: number): DrawnImage {
  const colors = MAP_COLORS[spec.theme];
  const font = `${COUNT_FONT_SIZE}px ${assets.displayFont}`;
  const measure = createCanvas(1, 1, 1).ctx;
  measure.font = font;

  const tiles = spec.groups.map((group, index) => {
    const label = clusterCountLabel(group.count);
    return {
      ...group,
      label,
      size: clusterTileSize(group.count),
      tilt: clusterTileTilt(index),
      pill: Math.max(COUNT_HEIGHT + 4, Math.ceil(measure.measureText(label).width) + 12),
    };
  });

  // Centres des piles : légèrement chevauchées, sans que les pastilles se touchent.
  const centers = [0];
  for (let i = 1; i < tiles.length; i += 1) {
    const a = tiles[i - 1];
    const b = tiles[i];
    centers.push(centers[i - 1] + Math.max((a.size + b.size) / 2 - 4, (a.pill + b.pill) / 2 + 3));
  }
  const first = tiles[0];
  const last = tiles[tiles.length - 1];
  const left = -Math.max(first.size / 2 + 3, first.pill / 2 + 2);
  const right = centers[centers.length - 1] + Math.max(last.size / 2 + STACK_OFFSET.x + 4, last.pill / 2 + 2);
  const maxSize = Math.max(...tiles.map((tile) => tile.size));

  // Image symétrique : son centre (ancre de l'icône) est le centre du groupe.
  const halfWidth = Math.ceil((right - left) / 2) + CLUSTER_PADDING;
  const halfHeight = Math.ceil(maxSize / 2 + COUNT_HEIGHT / 2 + 6) + CLUSTER_PADDING;
  const { canvas, ctx } = createCanvas(halfWidth * 2, halfHeight * 2, ratio);
  const originX = halfWidth - (right + left) / 2;
  const bottom = halfHeight + maxSize / 2 - 4; // bas commun des stickers

  tiles.forEach((tile, i) => {
    ctx.save();
    ctx.translate(originX + centers[i], bottom - tile.size / 2);
    if (tile.count > 1) {
      ctx.save();
      ctx.translate(STACK_OFFSET.x, STACK_OFFSET.y);
      ctx.rotate((tile.tilt + STACK_OFFSET.tilt) * DEG);
      drawStickerFace(ctx, tile.size, tile.color, assets, spec.theme, ratio);
      roundRect(ctx, -tile.size / 2, -tile.size / 2, tile.size, tile.size, markerRadius(tile.size));
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fill();
      ctx.restore();
    }
    ctx.rotate(tile.tilt * DEG);
    drawStickerFace(ctx, tile.size, tile.color, assets, spec.theme, ratio);
    ctx.restore();
  });

  // Pastilles par-dessus toutes les piles, cerclées de la couleur des cartes.
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  tiles.forEach((tile, i) => {
    const x = originX + centers[i];
    const y = bottom + 3;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 6 * ratio;
    ctx.shadowOffsetY = 2 * ratio;
    roundRect(ctx, x - tile.pill / 2 - 2, y - COUNT_HEIGHT / 2 - 2, tile.pill + 4, COUNT_HEIGHT + 4, COUNT_HEIGHT / 2 + 2);
    ctx.fillStyle = colors.card;
    ctx.fill();
    ctx.restore();
    roundRect(ctx, x - tile.pill / 2, y - COUNT_HEIGHT / 2, tile.pill, COUNT_HEIGHT, COUNT_HEIGHT / 2);
    ctx.fillStyle = BAND;
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(tile.label, x, y + 1);
  });

  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: ratio };
}
