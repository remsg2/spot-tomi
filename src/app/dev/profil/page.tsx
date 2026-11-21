import type { Metadata } from "next";
import { Suspense } from "react";
import { ColumnPage } from "@/components/leaderboard/column-page";
import { ProfileSkeleton, ProfileView } from "@/components/profile/profile-view";
import { DevOnly } from "../_etape7/dev-only";
import { profileFixture, type ProfileScenario } from "../_etape7/fixtures";

/*
 * Prévisualisation du profil et de l'album avec des données simulées
 * (développement uniquement ; textes internes hors i18n).
 *   ?qui=moi (défaut, avec stickers en attente et masqués) | autre (vue publique) | nouveau
 */

export const metadata: Metadata = {
  title: "Profil (aperçu)",
  robots: { index: false, follow: false },
};

const SCENARIOS: ProfileScenario[] = ["moi", "autre", "nouveau"];

export default function DevProfilePage({ searchParams }: PageProps<"/dev/profil">) {
  return (
    <Suspense fallback={null}>
      <DevOnly>
        <ColumnPage>
          <Suspense fallback={<ProfileSkeleton />}>
            <Preview searchParams={searchParams} />
          </Suspense>
        </ColumnPage>
      </DevOnly>
    </Suspense>
  );
}

async function Preview({ searchParams }: Pick<PageProps<"/dev/profil">, "searchParams">) {
  const params = await searchParams;
  const scenario = SCENARIOS.find((s) => s === params.qui) ?? "moi";
  const { identity, data, isMe } = profileFixture(scenario);
  return <ProfileView identity={identity} data={data} isMe={isMe} />;
}
