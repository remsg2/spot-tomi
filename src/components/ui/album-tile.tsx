import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";

type ConqueredProps = {
  variant?: "conquered";
  /** Code ISO 3166-1 alpha-3 (ex. ARG). */
  code: string;
  /** Couleur de l'année du premier sticker dans ce pays. */
  color?: string;
  points: number;
  gold?: boolean;
  tilt?: number;
  label?: string;
  className?: string;
};

type LockedProps = {
  variant: "locked";
  code: string;
  /** Points de base du pays. */
  points: number;
  label?: string;
  className?: string;
};

export type AlbumTileProps = ConqueredProps | LockedProps;

/** Tuile de l'album : un pays conquis, ou un pays à conquérir (pointillés). */
export function AlbumTile(props: AlbumTileProps) {
  if (props.variant === "locked") {
    return (
      <div
        role="img"
        aria-label={props.label}
        className={cn(
          "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[10px] border-2 border-dashed border-dash text-muted",
          props.className,
        )}
      >
        <span className="font-display text-[15px]">{props.code}</span>
        <span className="text-[10px] font-bold">{t.album.toConquer(props.points)}</span>
      </div>
    );
  }

  const { code, color, points, gold = false, tilt = 0, label, className } = props;
  const accent = color ?? "var(--year)";
  const shadow = gold
    ? "0 1px 2px rgb(0 0 0 / 0.15), 0 4px 10px rgb(0 0 0 / 0.12), 0 0 0 2px var(--gold), 0 0 10px rgb(233 181 47 / 0.7)"
    : "0 1px 2px rgb(0 0 0 / 0.15), 0 4px 10px rgb(0 0 0 / 0.12)";

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative aspect-square overflow-hidden rounded-[10px] font-display", className)}
      style={{ background: accent, transform: tilt ? `rotate(${tilt}deg)` : undefined, boxShadow: shadow }}
    >
      <span className="absolute top-[7px] left-2 text-[17px] text-on-year">{code}</span>
      <span className="absolute inset-0 bg-band [clip-path:polygon(0_100%,0_90%,100%_56%,100%_100%)]" />
      <span className="absolute right-1.5 bottom-1 text-[13px]" style={{ color: accent }}>
        {points}
      </span>
    </div>
  );
}
