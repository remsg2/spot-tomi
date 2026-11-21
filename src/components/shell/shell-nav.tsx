"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n/fr";
import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./routes";

const labels = {
  map: t.nav.map,
  leaderboard: t.nav.leaderboard,
  stats: t.nav.stats,
  profile: t.nav.profile,
  admin: tm.shell.admin,
} as const;

/** Navigation du haut de la colonne (tablette et web), en onglets segmentés. */
export function ShellNav({ staff }: { staff: boolean }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label={t.nav.label} className="flex gap-1 rounded-[14px] bg-soft p-1">
      {NAV_ITEMS.filter((item) => !item.staff || staff).map((item) => {
        const active = item.match(pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-[10px] text-[13px]",
              active ? "bg-card font-bold text-text shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "font-semibold text-muted",
            )}
          >
            {labels[item.key]}
          </Link>
        );
      })}
    </nav>
  );
}
