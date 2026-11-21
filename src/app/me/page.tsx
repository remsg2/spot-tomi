import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ProfileThemeSync } from "@/components/account/profile-theme-sync";
import { ColumnPage, LoadError } from "@/components/leaderboard/column-page";
import { ProfileSkeleton, ProfileView } from "@/components/profile/profile-view";
import { t } from "@/i18n/fr";
import { profileFr as p } from "@/i18n/profile.fr";
import { requireProfile } from "@/lib/auth/server";
import { getPublicEnv } from "@/lib/env/server";
import { avatarPublicUrl } from "@/lib/profile/avatar";
import { sinceYear } from "@/lib/profile/mappers";
import { fetchProfileData } from "@/lib/profile/queries";
import type { ProfileData } from "@/lib/profile/types";

export const metadata: Metadata = {
  title: p.metaMe,
  robots: { index: false, follow: false },
};

/**
 * Profil de l'utilisateur connecté (maquette Profil) : score, album et
 * stickers, y compris ceux en attente ou masqués. Remplace la page minimale
 * de l'étape 3, dont il garde la synchronisation du thème et la déconnexion.
 */
export default function MePage() {
  return (
    <ColumnPage>
      <Suspense fallback={<ProfileSkeleton />}>
        <MeContent />
      </Suspense>
    </ColumnPage>
  );
}

async function MeContent() {
  // Hors du try : la redirection vers /login ou /welcome doit passer.
  const { user, profile } = await requireProfile("/me");

  let data: ProfileData;
  let supabaseUrl: string;
  try {
    [data, { supabaseUrl }] = await Promise.all([fetchProfileData(user.id), getPublicEnv()]);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Profil indisponible", error);
    return <LoadError message={p.error} />;
  }

  const role = profile.suspended_at === null && profile.role !== "user" ? profile.role : null;
  return (
    <>
      <ProfileThemeSync theme={profile.theme} />
      <ProfileView
        isMe
        identity={{
          userId: profile.id,
          username: profile.username,
          avatarUrl: avatarPublicUrl(supabaseUrl, profile.avatar_path),
          sinceYear: sinceYear(profile.created_at),
          role,
        }}
        data={data}
      />
      <form action="/auth/signout" method="post" className="flex justify-center pt-2">
        <button type="submit" className="min-h-11 text-sm font-semibold underline underline-offset-4">
          {t.auth.signOut}
        </button>
      </form>
    </>
  );
}
