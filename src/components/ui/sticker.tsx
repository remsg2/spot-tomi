import Image from "next/image";
import type { CSSProperties } from "react";
import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";
import { TOMI_IMAGE } from "@/lib/tomi";

export type StickerProps = {
  /** Côté du carré en pixels. */
  size?: number;
  /** Couleur de l'année ; par défaut celle de l'année en cours (--year). */
  color?: string;
  /** Texte de la bande noire : l'année, ou les points sur les fiches. */
  band?: string;
  /** Petite ligne au-dessus de la bande (ex. pseudo), à partir de 140 px. */
  sub?: string;
  /** Anneau doré : premier du pays ou lieu exceptionnel. */
  gold?: boolean;
  /** Rotation en degrés (−5 à +7 pour l'effet « soulevé »). */
  tilt?: number;
  /** Animation « sticker collé » (ignorée si prefers-reduced-motion). */
  animate?: boolean;
  /** Texte alternatif ; sans lui, le sticker est décoratif. */
  label?: string;
  className?: string;
};

/**
 * Le sticker de Tomi, gabarit de toute l'interface : carré de la couleur de
 * l'année, titre TOMI, Tomi détouré, bande noire en diagonale (95 % → 64 %).
 */
export function Sticker({
  size = 320,
  color,
  band = "",
  sub = "",
  gold = false,
  tilt = 0,
  animate = false,
  label,
  className,
}: StickerProps) {
  const s = size;
  const accent = color ?? "var(--year)";
  const lift = `0 1px 2px rgb(0 0 0 / 0.2), 0 ${Math.round(s * 0.04)}px ${Math.round(s * 0.09)}px rgb(0 0 0 / 0.22)`;
  const ring = gold
    ? `, 0 0 0 ${Math.max(2, Math.round(s * 0.02))}px var(--gold), 0 0 ${Math.round(s * 0.12)}px rgb(233 181 47 / 0.65)`
    : "";
  const showSub = s >= 140 && sub !== "";

  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative shrink-0", className)}
      style={{ width: s, height: s, transform: tilt ? `rotate(${tilt}deg)` : undefined }}
      data-sticker=""
    >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden font-display text-band",
          animate && "animate-sticker-slap",
        )}
        style={{
          borderRadius: Math.max(3, Math.round(s * 0.035)),
          background: accent,
          boxShadow: lift + ring,
        }}
      >
        <span
          className="absolute left-[7%] leading-none tracking-[0.01em]"
          style={{ top: Math.round(s * 0.07), fontSize: Math.round(s * 0.2) }}
        >
          {t.sticker.title}
        </span>
        <Image
          src={TOMI_IMAGE.full.src}
          alt=""
          fill
          sizes={`${s}px`}
          className="object-cover"
        />
        <span className="absolute inset-0 bg-band [clip-path:polygon(0_95%,100%_64%,100%_100%,0_100%)]" />
        {showSub && (
          <span
            className="absolute right-[7%] font-sans font-semibold leading-none"
            style={{
              bottom: Math.round(s * 0.215),
              fontSize: Math.max(7, Math.round(s * 0.042)),
              color: accent,
            }}
          >
            {sub}
          </span>
        )}
        {band !== "" && (
          <span
            className="absolute right-[7%] whitespace-nowrap leading-none tracking-[0.01em]"
            style={{
              bottom: Math.round(s * 0.05),
              fontSize: Math.round(s * 0.13),
              color: accent,
            } as CSSProperties}
          >
            {band}
          </span>
        )}
      </div>
    </div>
  );
}
