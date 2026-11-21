import Link from "next/link";
import { PointsBlock } from "@/components/ui";
import { profileFr as p } from "@/i18n/profile.fr";
import { cn } from "@/lib/cn";
import type { ProfileIdentity, ProfileStats } from "@/lib/profile/types";
import { UserAvatar } from "./user-avatar";

const HIT_AREA = "relative after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']";

/** Avatar, pseudo, « Depuis AAAA », badge Admin/Modo et bouton Réglages (maquette Profil). */
export function ProfileHeader({ identity, isMe }: { identity: ProfileIdentity; isMe: boolean }) {
  const role = isMe ? identity.role : null;
  return (
    <header className="flex items-center gap-3.5">
      <UserAvatar
        userId={identity.userId}
        username={identity.username}
        avatarUrl={identity.avatarUrl}
        ring="0 0 0 3px var(--edge, var(--bg)), 0 0 0 6px var(--year)"
        className="size-[60px] font-display text-2xl"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate font-display text-2xl leading-none font-normal">{identity.username}</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] text-muted">{p.since(identity.sinceYear)}</span>
          {role && (
            <Link
              href={role === "admin" ? "/admin" : "/admin/moderation"}
              className={cn(HIT_AREA, "rounded-md bg-text px-[7px] py-0.5 text-[11px] font-bold text-bg")}
            >
              {role === "admin" ? p.roleAdmin : p.roleModerator}
            </Link>
          )}
        </div>
      </div>
      {isMe && (
        <Link
          href="/me/settings"
          aria-label={p.settings}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-text"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </Link>
      )}
    </header>
  );
}

/** Score total (bloc couleur de l'année) avec le rang, puis les trois compteurs. */
export function ProfileScore({ stats }: { stats: ProfileStats }) {
  return (
    <>
      <PointsBlock
        size="lg"
        signed={false}
        points={stats.points}
        eyebrow={p.scoreTotal}
        badge={
          <Link
            href="/leaderboard?periode=toujours"
            className={cn(HIT_AREA, "mt-0.5 rounded-md bg-band px-2 py-[3px] text-xs font-bold text-white")}
          >
            {stats.rank === null ? p.unranked : p.rankBadge(stats.rank)}
          </Link>
        }
      />
      <dl aria-label={p.stats.label} className="grid grid-cols-3 gap-2">
        <Stat value={stats.stickers} label={p.stats.stickers(stats.stickers)} />
        <Stat value={stats.countries} label={p.stats.countries()} />
        <Stat value={stats.firsts} label={p.stats.firsts(stats.firsts)} />
      </dl>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-line bg-card p-3">
      <dt className="order-2 text-xs text-muted">{label}</dt>
      <dd className="order-1 font-display text-[22px] leading-tight">{value}</dd>
    </div>
  );
}
