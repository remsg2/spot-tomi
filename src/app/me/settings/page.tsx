import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileThemeSync } from "@/components/account/profile-theme-sync";
import { t } from "@/i18n/fr";
import { requireProfile } from "@/lib/auth/server";
import { getPublicEnv } from "@/lib/env/server";
import { publicStorageUrl } from "@/lib/storage";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  AvatarSection,
  DeleteAccountSection,
  HomeSection,
  PasswordSection,
  ThemeSection,
  UsernameSection,
} from "./sections";

export const metadata: Metadata = { title: t.settings.title };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-6">
      <div className="flex flex-col gap-2">
        <Link href="/me" className="min-h-11 self-start text-sm font-semibold underline underline-offset-4">
          {t.settings.back}
        </Link>
        <h1 className="font-display text-3xl font-normal">{t.settings.title}</h1>
      </div>
      <Suspense fallback={null}>
        <SettingsContent />
      </Suspense>
    </main>
  );
}

async function SettingsContent() {
  const { user, profile } = await requireProfile("/me/settings");
  const { supabaseUrl } = await getPublicEnv();
  const supabase = await getSupabaseServerClient();
  // Seul le propriétaire peut lire son domicile ; on ne l'affiche pas, on dit seulement s'il existe.
  const { data: home } = await supabase.rpc("get_my_home");
  const hasHome = Array.isArray(home) && home.length > 0;
  const avatarUrl = profile.avatar_path ? publicStorageUrl(supabaseUrl, "avatars", profile.avatar_path) : null;

  return (
    <>
      <ProfileThemeSync theme={profile.theme} />
      <UsernameSection current={profile.username} />
      <AvatarSection
        userId={user.id}
        username={profile.username}
        avatarPath={profile.avatar_path}
        avatarUrl={avatarUrl}
      />
      <HomeSection hasHome={hasHome} />
      <ThemeSection />
      <PasswordSection />
      <DeleteAccountSection username={profile.username} />
    </>
  );
}
