import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/account/avatar";
import { ProfileThemeSync } from "@/components/account/profile-theme-sync";
import { Logo, TabBar } from "@/components/ui";
import { t } from "@/i18n/fr";
import { requireProfile } from "@/lib/auth/server";
import { getPublicEnv } from "@/lib/env/server";
import { publicStorageUrl } from "@/lib/storage";

export const metadata: Metadata = { title: t.auth.myProfile };

/** Profil minimal de l'étape 3 ; l'étape 7 le remplace (score, album, stickers). */
export default function MePage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 pt-5 pb-28">
        <Logo />
        <Suspense fallback={null}>
          <MeContent />
        </Suspense>
      </main>
      <TabBar className="fixed inset-x-0 bottom-0" />
    </>
  );
}

async function MeContent() {
  const { profile } = await requireProfile("/me");
  const { supabaseUrl } = await getPublicEnv();
  const avatarUrl = profile.avatar_path ? publicStorageUrl(supabaseUrl, "avatars", profile.avatar_path) : null;

  return (
    <>
      <ProfileThemeSync theme={profile.theme} />
      <div className="flex items-center gap-4">
        <Avatar username={profile.username} src={avatarUrl} />
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="font-display text-2xl leading-none font-normal">{profile.username}</h1>
          <span className="text-sm text-muted">
            {t.profile.since(new Date(profile.created_at).getFullYear())}
          </span>
        </div>
        <Link
          href="/me/settings"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
        >
          {t.me.settings}
        </Link>
      </div>
      <p id="album" className="text-muted">
        {t.me.comingSoon}
      </p>
      <form action="/auth/signout" method="post">
        <button type="submit" className="min-h-11 text-sm font-semibold underline underline-offset-4">
          {t.auth.signOut}
        </button>
      </form>
    </>
  );
}
