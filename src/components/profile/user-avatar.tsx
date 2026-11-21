import Image from "next/image";
import { cn } from "@/lib/cn";
import { avatarColor, initialOf } from "@/lib/leaderboard/leaderboard";

export type UserAvatarProps = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  /** Taille et typographie (ex. « size-9 text-sm font-extrabold »). */
  className?: string;
  /** Anneau en box-shadow (doré, couleur de l'année, bord). */
  ring?: string;
  /** Largeur maximale de l'image, pour l'attribut sizes. */
  px?: number;
};

/**
 * Avatar rond : la photo du compte, sinon son initiale sur une couleur stable.
 * Décoratif : le pseudo est toujours écrit à côté.
 */
export function UserAvatar({ userId, username, avatarUrl, className, ring, px = 60 }: UserAvatarProps) {
  return (
    <span
      aria-hidden="true"
      data-avatar=""
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white",
        className,
      )}
      style={{ background: avatarUrl ? "var(--soft)" : avatarColor(userId), boxShadow: ring }}
    >
      {avatarUrl ? (
        // URL du Storage connue au runtime seulement : pas d'optimisation Next.
        <Image src={avatarUrl} alt="" fill unoptimized sizes={`${px}px`} className="object-cover" />
      ) : (
        initialOf(username)
      )}
    </span>
  );
}
