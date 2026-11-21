import Image from "next/image";
import { cn } from "@/lib/cn";
import { markerSize } from "@/lib/design/points";
import { TOMI_IMAGE } from "@/lib/tomi";

export type MapMarkerProps = {
  /** Points du sticker : fixent la taille (26, 34 ou 44 px). */
  points: number;
  /** Couleur de l'année du sticker ; par défaut l'année en cours. */
  color?: string;
  /** Anneau doré : premier du pays ou lieu exceptionnel. */
  gold?: boolean;
  selected?: boolean;
  /** Points en attente de validation : rien dans la bande. */
  pending?: boolean;
  className?: string;
};

/** Mini-sticker posé sur la carte. Les points s'affichent dans la bande dès 34 px. */
export function MapMarker({
  points,
  color,
  gold = false,
  selected = false,
  pending = false,
  className,
}: MapMarkerProps) {
  const s = markerSize(points);
  const accent = color ?? "var(--year)";
  const shadows = ["0 2px 6px rgb(0 0 0 / 0.3)"];
  if (gold) shadows.push("0 0 0 2px var(--gold)", "0 0 12px rgb(233 181 47 / 0.75)");
  if (selected) shadows.push(`0 0 0 ${gold ? 6 : 4}px var(--text)`);
  const showPoints = s >= 34 && !pending;

  return (
    <span
      aria-hidden="true"
      data-marker-size={s}
      className={cn(
        "relative block shrink-0 overflow-hidden border-2 border-solid font-display",
        className,
      )}
      style={{
        width: s,
        height: s,
        borderRadius: Math.round(s * 0.16),
        borderColor: "var(--marker-edge)",
        background: accent,
        transform: "rotate(-5deg)",
        boxShadow: shadows.join(", "),
      }}
    >
      <Image
        src={TOMI_IMAGE.head.src}
        alt=""
        width={s}
        height={s}
        className="absolute top-[10%] left-[6%] h-[94%] w-[94%]"
      />
      <span className="absolute inset-0 bg-band [clip-path:polygon(0_96%,100%_62%,100%_100%,0_100%)]" />
      {showPoints && (
        <span
          className="absolute right-0.5 bottom-px leading-none"
          style={{ fontSize: s >= 44 ? 12 : 9, color: accent }}
        >
          {points}
        </span>
      )}
    </span>
  );
}
