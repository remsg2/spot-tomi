import { profileFr as p } from "@/i18n/profile.fr";
import { buildAlbumView } from "@/lib/profile/album";
import type { LedgerLine, Notice, ProfileData, ProfileIdentity } from "@/lib/profile/types";
import { BadgesSection, LedgerSection, MemberStatsSection, NoticesSection, PassportSection } from "./collection-sections";
import { ProfileHeader, ProfileScore } from "./profile-header";
import { ScrollToHash } from "./scroll-to-hash";
import { SpotList } from "./spot-list";

export type ProfileViewProps = {
  identity: ProfileIdentity;
  data: ProfileData;
  /** Son propre profil (/me) : réglages, badge de rôle, stickers en attente. */
  isMe: boolean;
  /** Son propre profil : avis reçus et journal de points. */
  notices?: Notice[];
  ledger?: LedgerLine[];
};

/**
 * Profil (maquette Profil, cahier des charges 3 et 8) pour /me et /u/[username] : score,
 * avis (soi), passeport, badges, statistiques, stickers, journal de points (soi).
 */
export function ProfileView({ identity, data, isMe, notices, ledger }: ProfileViewProps) {
  const album = buildAlbumView(data.album);
  return (
    <>
      <ProfileHeader identity={identity} isMe={isMe} />
      <ProfileScore stats={data.stats} />
      {isMe && notices && notices.length > 0 && <NoticesSection notices={notices} />}
      <PassportSection stamps={data.passport} album={album} countriesTotal={data.countriesTotal} isMe={isMe} />
      <BadgesSection badges={data.badges} />
      <MemberStatsSection member={data.member} progress={data.progress} />
      <SpotList spots={data.spots} isMe={isMe} />
      {isMe && ledger && <LedgerSection lines={ledger} />}
      <ScrollToHash id="album" />
      <ScrollToHash id="stats" />
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
