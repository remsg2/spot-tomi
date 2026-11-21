/**
 * Règles du gabarit d'application selon la page (spécifications 5 ; contrats §5).
 *
 * Sous 768 px :
 * - « map »   : la carte en plein écran, la barre d'onglets en bas (page /) ;
 * - « sheet » : la carte et la fiche lieu dans un tiroir, sans barre d'onglets ;
 * - « page »  : la page en plein écran avec la barre d'onglets (classement, profil…).
 * À partir de 768 px, toutes les pages du gabarit s'affichent dans la colonne de
 * gauche, la carte à droite.
 */
export type MobileMode = "map" | "page" | "sheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSpotId(value: string): boolean {
  return UUID.test(value);
}

/** Identifiant du sticker de la fiche ouverte (/spots/<uuid>), sinon null. */
export function spotIdFromPath(pathname: string): string | null {
  const match = /^\/spots\/([^/?#]+)\/?$/.exec(pathname);
  return match && isSpotId(match[1]) ? match[1].toLowerCase() : null;
}

export function mobileModeFor(pathname: string): MobileMode {
  if (pathname === "/") return "map";
  if (spotIdFromPath(pathname)) return "sheet";
  return "page";
}

export type NavItem = {
  key: "map" | "leaderboard" | "album" | "profile" | "admin";
  href: string;
  /** Réservé aux modérateurs et admins. */
  staff?: boolean;
  match: (pathname: string) => boolean;
};

/** Navigation du haut de la colonne (tablette et web), comme la maquette Web. */
export const NAV_ITEMS: NavItem[] = [
  { key: "map", href: "/", match: (p) => p === "/" || spotIdFromPath(p) !== null },
  { key: "leaderboard", href: "/leaderboard", match: (p) => p.startsWith("/leaderboard") },
  { key: "album", href: "/me#album", match: () => false },
  { key: "profile", href: "/me", match: (p) => p.startsWith("/me") || p.startsWith("/u/") },
  { key: "admin", href: "/admin/season", staff: true, match: (p) => p.startsWith("/admin") },
];
