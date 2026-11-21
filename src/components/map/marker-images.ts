/**
 * Dessin des images de marqueurs et de groupes, une fois par apparence, pour
 * MapLibre (map.addImage). Reprend fidèlement MapMarker et ClusterBubble
 * (src/components/ui) : 5 000 stickers deviennent quelques dizaines d'images
 * partagées, rendues par le GPU, au lieu de 5 000 éléments DOM.
 */
import {
  CLUSTER_STICKER_SIZE,
  CLUSTER_STICKER_STEP,
  clusterCountLabel,
  clusterStickerTilt,
  type ClusterSpec,
} from "@/lib/map/clusters";
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

/** Bulle d'un groupe : hauteur, police du total, anneau et marge pour l'ombre. */
const BUBBLE_HEIGHT = 34;
const BUBBLE_FONT_SIZE = 16;
const BUBBLE_RING = 3;
const BUBBLE_SHADOW = 14;

/**
 * Bulle d'un groupe : les mini-stickers de Tomi des années présentes (la plus
 * ancienne à gauche), puis le nombre total de stickers, sans détail par année.
 */
export function drawCluster(spec: ClusterSpec, assets: MarkerAssets, ratio: number): DrawnImage {
  const colors = MAP_COLORS[spec.theme];
  const label = clusterCountLabel(spec.total);
  const font = `${BUBBLE_FONT_SIZE}px ${assets.displayFont}`;
  const measure = createCanvas(1, 1, 1).ctx;
  measure.font = font;
  const textWidth = Math.ceil(measure.measureText(label).width);

  const stickersWidth = CLUSTER_STICKER_SIZE + (spec.colors.length - 1) * CLUSTER_STICKER_STEP;
  const padLeft = 7;
  const gap = 7;
  const padRight = 13;
  const bubbleWidth = padLeft + stickersWidth + gap + textWidth + padRight;
  const margin = BUBBLE_RING + BUBBLE_SHADOW;
  const { canvas, ctx } = createCanvas(bubbleWidth + margin * 2, BUBBLE_HEIGHT + margin * 2, ratio);
  const x0 = margin;
  const y0 = margin;

  // Anneau de la couleur des cartes et ombre douce, comme les pastilles de l'app.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 16 * ratio;
  ctx.shadowOffsetY = 6 * ratio;
  const outer = BUBBLE_HEIGHT + BUBBLE_RING * 2;
  roundRect(ctx, x0 - BUBBLE_RING, y0 - BUBBLE_RING, bubbleWidth + BUBBLE_RING * 2, outer, outer / 2);
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x0, y0, bubbleWidth, BUBBLE_HEIGHT, BUBBLE_HEIGHT / 2);
  ctx.fillStyle = BAND;
  ctx.fill();

  spec.colors.forEach((color, i) => {
    ctx.save();
    ctx.translate(x0 + padLeft + CLUSTER_STICKER_SIZE / 2 + i * CLUSTER_STICKER_STEP, y0 + BUBBLE_HEIGHT / 2);
    ctx.rotate(clusterStickerTilt(i) * DEG);
    drawStickerFace(ctx, CLUSTER_STICKER_SIZE, color, assets, spec.theme, ratio);
    ctx.restore();
  });

  ctx.font = font;
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x0 + padLeft + stickersWidth + gap, y0 + BUBBLE_HEIGHT / 2 + 1);

  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: ratio };
}
