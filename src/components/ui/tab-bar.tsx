"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@/i18n/fr";
import { cn } from "@/lib/cn";

const icon = {
  map: (
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />
  ),
  leaderboard: (
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  ),
  album: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
} satisfies Record<string, ReactNode>;

type Tab = { href: string; label: string; icon: keyof typeof icon; match: (path: string) => boolean };

/** L'album est une section de la page profil (/me#album), comme dans les maquettes. */
const TABS: Tab[] = [
  { href: "/", label: t.nav.map, icon: "map", match: (p) => p === "/" || p.startsWith("/spots/") && p !== "/spots/new" },
  { href: "/leaderboard", label: t.nav.leaderboard, icon: "leaderboard", match: (p) => p.startsWith("/leaderboard") },
  { href: "/me#album", label: t.nav.album, icon: "album", match: () => false },
  { href: "/me", label: t.nav.profile, icon: "profile", match: (p) => p.startsWith("/me") || p.startsWith("/u/") },
];

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-col items-center gap-1 pt-2 text-[11px]",
        active ? "font-bold text-text" : "font-semibold text-muted",
      )}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {icon[tab.icon]}
      </svg>
      {tab.label}
    </Link>
  );
}

/**
 * Barre d'onglets mobile (< 768 px), avec le « + » central en mini-sticker.
 * `responsive={false}` l'affiche à toutes les largeurs (page /dev/design).
 */
export function TabBar({
  className,
  responsive = true,
}: {
  className?: string;
  responsive?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const [map, leaderboard, album, profile] = TABS;

  return (
    <nav
      aria-label={t.nav.label}
      className={cn(
        "grid h-[calc(80px+env(safe-area-inset-bottom))] grid-cols-5 items-center border-t border-line bg-card px-2.5 pb-[calc(14px+env(safe-area-inset-bottom))]",
        responsive && "md:hidden",
        className,
      )}
    >
      <TabLink tab={map} active={map.match(pathname)} />
      <TabLink tab={leaderboard} active={leaderboard.match(pathname)} />
      <Link
        href="/spots/new"
        aria-label={t.nav.add}
        aria-current={pathname === "/spots/new" ? "page" : undefined}
        className="relative -top-4 flex size-[62px] -rotate-5 items-center justify-center justify-self-center overflow-hidden rounded-[18px] bg-year text-on-year"
        style={{ boxShadow: "0 0 0 4px var(--card), 0 8px 18px rgb(0 0 0 / 0.28)" }}
      >
        <span className="absolute inset-0 bg-band [clip-path:polygon(0_100%,0_88%,100%_58%,100%_100%)]" />
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          aria-hidden="true"
          className="relative -mt-2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
      <TabLink tab={album} active={album.match(pathname)} />
      <TabLink tab={profile} active={profile.match(pathname)} />
    </nav>
  );
}
