/** Niveau d'accès à l'admin, comme is_admin() / is_moderator() en SQL (étape 3). */
export type StaffLevel = "admin" | "moderator";

type RoleProfile = { role: "user" | "moderator" | "admin"; suspended_at: string | null };

/** Un compte suspendu perd tous ses droits, même admin. */
export function staffLevel(profile: RoleProfile | null | undefined): StaffLevel | null {
  if (!profile || profile.suspended_at !== null) return null;
  if (profile.role === "admin") return "admin";
  if (profile.role === "moderator") return "moderator";
  return null;
}

/** Un admin a aussi les droits de modération. */
export function canAccess(level: StaffLevel | null, required: StaffLevel): boolean {
  if (level === null) return false;
  return required === "moderator" || level === "admin";
}

export type AdminTab = "season" | "moderation" | "scoring" | "roles" | "badges" | "errors" | "journal";

/** Onglets de l'admin et rôle requis (spécifications, 4). */
export const ADMIN_TABS: ReadonlyArray<{ tab: AdminTab; href: `/admin/${AdminTab}`; required: StaffLevel }> = [
  { tab: "season", href: "/admin/season", required: "admin" },
  { tab: "moderation", href: "/admin/moderation", required: "moderator" },
  { tab: "scoring", href: "/admin/scoring", required: "admin" },
  { tab: "roles", href: "/admin/roles", required: "admin" },
  { tab: "badges", href: "/admin/badges", required: "admin" },
  { tab: "errors", href: "/admin/errors", required: "admin" },
  { tab: "journal", href: "/admin/journal", required: "admin" },
];

export function visibleTabs(level: StaffLevel | null) {
  return ADMIN_TABS.filter((entry) => canAccess(level, entry.required));
}

/** Page d'arrivée de /admin selon le rôle. */
export function adminHome(level: StaffLevel): string {
  return level === "admin" ? "/admin/season" : "/admin/moderation";
}
