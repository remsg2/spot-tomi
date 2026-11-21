"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ta } from "@/i18n/admin.fr";
import { visibleTabs, type StaffLevel } from "@/lib/admin/roles";
import { cn } from "@/lib/cn";

/**
 * Onglets de l'admin (contrôle segmenté de la maquette). Ce sont des pages :
 * liens avec aria-current, et seuls les onglets permis au rôle sont listés.
 */
export function AdminTabs({ level, moderationCount }: { level: StaffLevel; moderationCount: number }) {
  const pathname = usePathname() ?? "";
  // Les quatre onglets de la maquette ; le journal s'ouvre depuis l'en-tête.
  const tabs = visibleTabs(level).filter(({ tab }) => tab !== "journal");

  return (
    <nav aria-label={ta.tabsLabel} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1.5 rounded-[14px] bg-soft p-1 min-[380px]:min-w-0">
        {tabs.map(({ tab, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={tab} className="flex flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[13px] whitespace-nowrap",
                  active
                    ? "bg-card font-bold text-text shadow-[0_1px_3px_rgb(0_0_0/0.12)]"
                    : "font-semibold text-muted",
                )}
              >
                {ta.tabs[tab]}
                {tab === "moderation" && moderationCount > 0 && (
                  <>
                    <span
                      aria-hidden="true"
                      className="rounded-full bg-gold px-1.5 py-px text-[11px] font-extrabold text-band"
                    >
                      {moderationCount}
                    </span>
                    <span className="sr-only">, {ta.toModerate(moderationCount)}</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
