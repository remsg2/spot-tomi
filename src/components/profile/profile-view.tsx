import { profileFr as p } from "@/i18n/profile.fr";
import { buildAlbumView } from "@/lib/profile/album";
import type { ProfileData, ProfileIdentity } from "@/lib/profile/types";
import { AlbumSection } from "./album-section";
import { ProfileHeader, ProfileScore } from "./profile-header";
import { ScrollToHash } from "./scroll-to-hash";
import { SpotList } from "./spot-list";

export type ProfileViewProps = {
  identity: ProfileIdentity;
  data: ProfileData;
  /** Son propre profil (/me) : réglages, badge de rôle, stickers en attente. */
  isMe: boolean;
};

/** Profil et album (maquette Profil), pour /me et /u/[username]. */
export function ProfileView({ identity, data, isMe }: ProfileViewProps) {
  const album = buildAlbumView(data.album);
  return (
    <>
      <ProfileHeader identity={identity} isMe={isMe} />
      <ProfileScore stats={data.stats} />
      <AlbumSection album={album} isMe={isMe} />
      <SpotList spots={data.spots} isMe={isMe} />
      <ScrollToHash id="album" />
    </>
  );
}

/** Squelette du profil pendant le chargement. */
export function ProfileSkeleton() {
  return (
    <div role="status" aria-label={p.loading} className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3.5">
        <span className="size-[60px] rounded-full bg-soft" />
        <span className="flex flex-1 flex-col gap-2">
          <span className="h-6 w-32 rounded-md bg-soft" />
          <span className="h-4 w-24 rounded-md bg-soft" />
        </span>
      </div>
      <span className="h-[140px] rounded-[22px] bg-soft" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="h-[66px] rounded-2xl bg-soft" />
        ))}
      </div>
      <span className="h-6 w-20 rounded-md bg-soft" />
      <div className="grid grid-cols-4 gap-[9px]">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="aspect-square rounded-[10px] bg-soft" />
        ))}
      </div>
    </div>
  );
}
