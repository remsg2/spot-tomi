/**
 * Dessin des images de marqueurs et de pastilles, une fois par apparence, pour
 * MapLibre (map.addImage). Reprend fidèlement MapMarker et ClusterPill
 * (src/components/ui) : 5 000 stickers deviennent quelques dizaines d'images
 * partagées, rendues par le GPU, au lieu de 5 000 éléments DOM.
 */
import { formatPoints } from "@/lib/design/points";
import { t } from "@/i18n/fr";
import {
  MARKER_PADDING,
  markerFontSize,
  markerRadius,
  selectionRing,
  type ClusterSpec,
  type MarkerSpec,
} from "@/lib/map/markers";
import { MAP_COLORS } from "@/lib/map/style";

const BAND = "#111111";
const GOLD = "#E9B52F";

export type MarkerAssets = {
  /** Tête de Tomi (public/tomi/tomi-head.png), déjà décodée. */
  head: HTMLImageElement;
  displayFont: string;
  sansFont: string;
  /** Couleur de l'année en cours (points des pastilles). */
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

/** Mini-sticker : carré de la couleur de l'année, bord, Tomi, bande et points. */
export function drawMarker(spec: MarkerSpec, assets: MarkerAssets, ratio: number): DrawnImage {
  const s = spec.size;
  const box = s + MARKER_PADDING * 2;
  const { canvas, ctx } = createCanvas(box, box, ratio);
  const colors = MAP_COLORS[spec.theme];
  const half = s / 2;
  const r = markerRadius(s);

  ctx.translate(box / 2, box / 2);
  ctx.rotate((-5 * Math.PI) / 180);

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

  // Ombre portée et bord (2 px) du sticker.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 6 * ratio;
  ctx.shadowOffsetY = 2 * ratio;
  roundRect(ctx, -half, -half, s, s, r);
  ctx.fillStyle = colors.edge;
  ctx.fill();
  ctx.restore();

  // Intérieur : couleur, Tomi, bande noire (0 96 %, 100 % 62 %), points.
  const inner = s - 4;
  const x0 = -half + 2;
  const y0 = -half + 2;
  ctx.save();
  roundRect(ctx, x0, y0, inner, inner, Math.max(0, r - 2));
  ctx.clip();
  ctx.fillStyle = spec.color;
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
  if (spec.label) {
    ctx.fillStyle = spec.color;
    ctx.font = `${markerFontSize(s)}px ${assets.displayFont}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(spec.label, x0 + inner - 2, y0 + inner - 2);
  }
  ctx.restore();

  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: ratio };
}

/** Pastille noire d'un groupe : nombre de stickers et total des points. */
export function drawCluster(spec: ClusterSpec, assets: MarkerAssets, ratio: number): DrawnImage {
  const count = String(spec.count);
  const points = `${formatPoints(spec.points)} ${t.points.unit}`;
  const countFont = `16px ${assets.displayFont}`;
  const pointsFont = `700 12px ${assets.sansFont}`;

  const measure = createCanvas(1, 1, 1).ctx;
  measure.font = countFont;
  const countWidth = measure.measureText(count).width;
  measure.font = pointsFont;
  const pointsWidth = measure.measureText(points).width;

  const pillWidth = Math.ceil(10 + countWidth + 6 + pointsWidth + 12);
  const pillHeight = 32;
  const pad = 20;
  const width = pillWidth + pad * 2;
  const height = pillHeight + pad * 2;
  const { canvas, ctx } = createCanvas(width, height, ratio);
  const colors = MAP_COLORS[spec.theme];

  // Anneau de la couleur des cartes (3 px) et ombre douce.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 16 * ratio;
  ctx.shadowOffsetY = 6 * ratio;
  roundRect(ctx, pad - 3, pad - 3, pillWidth + 6, pillHeight + 6, (pillHeight + 6) / 2);
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, pad, pad, pillWidth, pillHeight, pillHeight / 2);
  ctx.fillStyle = BAND;
  ctx.fill();

  const baseline = pad + pillHeight / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = countFont;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(count, pad + 10, baseline + 1);
  ctx.font = pointsFont;
  ctx.fillStyle = assets.yearColor;
  ctx.fillText(points, pad + 10 + countWidth + 6, baseline + 1);

  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: ratio };
}
