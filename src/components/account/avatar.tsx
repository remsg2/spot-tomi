import { cn } from "@/lib/cn";

/**
 * Avatar rond : photo si disponible, sinon l'initiale sur fond noir,
 * cerclé de la couleur de l'année (maquette Profil).
 */
export function Avatar({
  username,
  src,
  size = 60,
  ring = true,
  className,
}: {
  username: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-band font-display text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        boxShadow: ring ? "0 0 0 3px var(--bg), 0 0 0 6px var(--year)" : undefined,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- fichier Storage, déjà réduit à 256 px
        <img src={src} alt="" width={size} height={size} className="size-full object-cover" />
      ) : (
        username.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
