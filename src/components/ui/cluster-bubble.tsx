import Image from "next/image";
import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";
import { CLUSTER_STICKER_SIZE, CLUSTER_STICKER_STEP, clusterCountLabel, clusterStickerTilt } from "@/lib/map/clusters";
import { TOMI_IMAGE } from "@/lib/tomi";

export type ClusterBubbleProps = {
  /** Nombre total de stickers du groupe. */
  total: number;
  /** Couleurs des années présentes, la plus ancienne d'abord ; par défaut l'année en cours. */
  colors?: string[];
  /** Années présentes (lecteurs d'écran), dans le même ordre. */
  years?: number[];
  className?: string;
};

/**
 * Groupe de stickers sur la carte : une bulle avec les mini-stickers de Tomi des
 * années présentes et le nombre total de stickers, sans détail par année.
 * Version DOM de l'image dessinée par drawCluster (carte MapLibre).
 */
export function ClusterBubble({ total, colors = ["var(--year)"], years, className }: ClusterBubbleProps) {
  const size = CLUSTER_STICKER_SIZE;
  return (
    <span
      role="img"
      aria-label={t.cluster.label(total, years)}
      className={cn("inline-flex h-[34px] items-center gap-[7px] rounded-full bg-band pr-[13px] pl-[7px] text-white", className)}
      style={{ boxShadow: "0 0 0 3px var(--card), 0 6px 16px rgb(0 0 0 / 0.3)" }}
    >
      <span aria-hidden="true" className="relative shrink-0" style={{ width: size + (colors.length - 1) * CLUSTER_STICKER_STEP, height: size }}>
        {colors.map((color, index) => (
          <span
            key={index}
            className="absolute top-0 overflow-hidden border-[1.5px] border-solid"
            style={{
              left: index * CLUSTER_STICKER_STEP,
              width: size,
              height: size,
              borderRadius: Math.round(size * 0.16),
              borderColor: "var(--marker-edge)",
              background: color,
              transform: `rotate(${clusterStickerTilt(index)}deg)`,
              boxShadow: "0 1px 3px rgb(0 0 0 / 0.3)",
            }}
          >
            <Image src={TOMI_IMAGE.head.src} alt="" width={size} height={size} className="absolute top-[10%] left-[6%] h-[94%] w-[94%]" />
            <span className="absolute inset-0 bg-band [clip-path:polygon(0_96%,100%_62%,100%_100%,0_100%)]" />
          </span>
        ))}
      </span>
      <span className="font-display text-base leading-none">{clusterCountLabel(total)}</span>
    </span>
  );
}
