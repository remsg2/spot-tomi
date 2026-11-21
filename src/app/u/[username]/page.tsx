import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ColumnPage, LoadError } from "@/components/leaderboard/column-page";
import { ProfileSkeleton, ProfileView } from "@/components/profile/profile-view";
import { profileFr as p } from "@/i18n/profile.fr";
import { fetchProfileData, fetchPublicProfile } from "@/lib/profile/queries";
import { countsForScore } from "@/lib/profile/spots";
import type { ProfileData, ProfileIdentity } from "@/lib/profile/types";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: p.metaUser(username) };
}

/** Profil public d'un membre : stickers publiés seulement. */
export default function UserProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <ColumnPage>
      <Suspense fallback={<ProfileSkeleton />}>
        <UserProfileContent params={params} />
      </Suspense>
    </ColumnPage>
  );
}

async function UserProfileContent({ params }: Pick<PageProps<"/u/[username]">, "params">) {
  const { username } = await params;

  let identity: ProfileIdentity | null;
  let data: ProfileData | null = null;
  try {
    identity = await fetchPublicProfile(username);
    if (identity) data = await fetchProfileData(identity.userId);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Profil public indisponible", error);
    return <LoadError message={p.error} />;
  }
  // Hors du try : notFound() interrompt le rendu par une exception.
  if (!identity || !data) notFound();

  // Vue publique, même pour son propre profil : ni en attente, ni masqués.
  const publicData: ProfileData = { ...data, spots: data.spots.filter(countsForScore) };
  return <ProfileView identity={identity} data={publicData} isMe={false} />;
}
