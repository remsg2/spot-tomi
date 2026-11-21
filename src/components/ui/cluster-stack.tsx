import Image from "next/image";
import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";
import { clusterCountLabel, clusterTileSize, clusterTileTilt } from "@/lib/map/clusters";
import { TOMI_IMAGE } from "@/lib/tomi";

export type ClusterStackGroup = {
  /** Nombre de stickers de l'année dans le groupe. */
  count: number;
  /** Couleur de l'année ; par défaut l'année en cours. */
  color?: string;
  year?: number;
};

export type ClusterStackProps = {
  /** Une entrée par année présente, la plus ancienne d'abord. */
  groups: ClusterStackGroup[];
  className?: string;
};

const SHADOW = "0 2px 6px rgb(0 0 0 / 0.3)";

/**
 * Groupe de stickers sur la carte : une pile par année présente, du sticker de
 * Tomi de son année, avec son nombre de stickers. Les années ne se mélangent
 * jamais. Version DOM de l'image dessinée par drawCluster (carte MapLibre).
 */
export function ClusterStack({ groups, className }: ClusterStackProps) {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return (
    <span
      role="img"
      aria-label={t.cluster.label(total, groups)}
      className={cn("inline-flex items-end -space-x-1 pb-2.5", className)}
    >
      {groups.map((group, index) => {
        const size = clusterTileSize(group.count);
        const tilt = clusterTileTilt(index);
        const card = {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.16),
          borderColor: "var(--marker-edge)",
          background: group.color ?? "var(--year)",
          boxShadow: SHADOW,
        };
        return (
          <span key={index} aria-hidden="true" className="relative shrink-0" style={{ width: size, height: size }}>
            {group.count > 1 && (
              // Carte du dessous : effet de pile.
              <span
                className="absolute inset-0 border-2 border-solid brightness-[0.78]"
                style={{ ...card, transform: `translate(4px, -4px) rotate(${tilt + 9}deg)` }}
              />
            )}
            <span
              className="absolute inset-0 overflow-hidden border-2 border-solid"
              style={{ ...card, transform: `rotate(${tilt}deg)` }}
            >
              <Image
                src={TOMI_IMAGE.head.src}
                alt=""
                width={size}
                height={size}
                className="absolute top-[10%] left-[6%] h-[94%] w-[94%]"
              />
              <span className="absolute inset-0 bg-band [clip-path:polygon(0_96%,100%_62%,100%_100%,0_100%)]" />
            </span>
            <span
              className="absolute -bottom-3 left-1/2 z-10 min-w-[22px] -translate-x-1/2 rounded-full bg-band px-1.5 text-center font-display text-[11px] leading-[18px] text-white"
              style={{ boxShadow: `0 0 0 2px var(--card), ${SHADOW}` }}
            >
              {clusterCountLabel(group.count)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
