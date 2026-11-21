import type { ReactNode } from "react";
import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";
import { formatPoints } from "@/lib/design/points";

export type PointsBlockProps = {
  points: number;
  /** Petite étiquette en capitales (ex. « Rareté », « Score total »). */
  eyebrow?: string;
  /** Ligne sous l'étiquette (ex. « Pays lointain »). */
  label?: string;
  /** Contenu libre sous l'étiquette (ex. pastille « 2ᵉ au classement »). */
  badge?: ReactNode;
  /** Points en attente de validation. */
  pending?: boolean;
  /** « +195 » sur une fiche, « 1 435 » pour un score. */
  signed?: boolean;
  /** md : fiche lieu ; lg : profil. */
  size?: "md" | "lg";
  color?: string;
  className?: string;
};

/** Bloc couleur de l'année, bande noire diagonale et total en très gros chiffres. */
export function PointsBlock({
  points,
  eyebrow,
  label,
  badge,
  pending = false,
  signed = true,
  size = "md",
  color,
  className,
}: PointsBlockProps) {
  const accent = color ?? "var(--year)";
  const value = pending
    ? t.points.pending
    : `${signed ? "+" : ""}${formatPoints(points)}`;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden text-on-year shadow-[0_1px_2px_rgb(0_0_0/0.12),0_10px_24px_rgb(0_0_0/0.14)]",
        size === "lg" ? "h-[140px] rounded-[22px]" : "h-[132px] rounded-[20px]",
        className,
      )}
      style={{ background: accent }}
    >
      <div className="absolute top-4 left-[18px] flex flex-col items-start gap-1">
        {eyebrow && (
          <span className="text-[11px] font-extrabold tracking-[0.1em] uppercase">{eyebrow}</span>
        )}
        {label && <span className="text-sm font-semibold">{label}</span>}
        {badge}
      </div>
      <div
        className={cn(
          "absolute inset-0 bg-band",
          size === "lg"
            ? "[clip-path:polygon(0_100%,0_86%,100%_30%,100%_100%)]"
            : "[clip-path:polygon(0_100%,0_84%,100%_26%,100%_100%)]",
        )}
      />
      <div
        className="absolute right-[18px] bottom-3 flex items-baseline gap-1.5"
        style={{ color: accent }}
      >
        <span
          className={cn(
            "font-display leading-none",
            pending ? "text-3xl" : size === "lg" ? "text-[60px]" : "text-[56px]",
          )}
        >
          {value}
        </span>
        {!pending && <span className="text-sm font-bold">{t.points.unit}</span>}
      </div>
    </div>
  );
}
