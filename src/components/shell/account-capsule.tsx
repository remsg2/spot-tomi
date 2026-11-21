import Link from "next/link";
import { ScoreCapsule } from "@/components/ui";
import { tm } from "@/i18n/map.fr";
import { getMyScore, getViewer } from "@/lib/spots/server";
import { ShellNav } from "./shell-nav";

const pill = "inline-flex h-11 shrink-0 items-center rounded-full";

/** Emplacement réservé pendant le chargement de la session (pas de saut de mise en page). */
export function AccountSkeleton() {
  return (
    <span
      aria-label={tm.shell.loadingAccount}
      role="status"
      className={`${pill} w-[112px] animate-pulse bg-soft`}
    />
  );
}

/**
 * En-tête : score et rang si l'on est connecté (profile_stats de l'étape 7),
 * sinon lien de connexion. Sans sticker publié (pas encore de rang), une
 * capsule neutre mène au profil.
 */
export async function AccountCapsule() {
  const { user, profile } = await getViewer();
  if (!user) {
    return (
      <Link
        href="/login?next=/"
        className={`${pill} bg-card px-4 text-sm font-bold text-text shadow-card`}
      >
        {tm.shell.login}
      </Link>
    );
  }

  const score = await getMyScore(user.id);
  if (score) return <ScoreCapsule rank={score.rank} score={score.score} />;

  const initial = (profile?.username ?? user.email ?? "?").charAt(0).toUpperCase();
  return (
    <Link
      href={profile ? "/me" : "/welcome"}
      aria-label={tm.shell.scoreUnknown}
      className={`${pill} gap-2 bg-band pr-3.5 pl-1.5 text-white shadow-[0_4px_12px_rgb(0_0_0/0.2)]`}
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-year text-xs font-extrabold text-on-year">
        {initial}
      </span>
      <span className="text-[13px] font-semibold">{tm.shell.myProfile}</span>
    </Link>
  );
}

/** Navigation du haut de la colonne, avec l'onglet Admin pour les modérateurs. */
export async function StaffAwareNav() {
  const { profile } = await getViewer();
  const staff = profile?.role === "admin" || profile?.role === "moderator";
  return <ShellNav staff={staff} />;
}
