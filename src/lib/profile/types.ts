import type { AlbumRow } from "./album";
import type { ProfileSpot } from "./spots";

export type ProfileIdentity = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  sinceYear: number;
  /** Seulement sur son propre profil : le rôle n'est pas public. */
  role: "admin" | "moderator" | null;
};

export type ProfileStats = {
  points: number;
  rank: number | null;
  stickers: number;
  countries: number;
  firsts: number;
};

export type ProfileData = {
  stats: ProfileStats;
  album: AlbumRow[];
  spots: ProfileSpot[];
};
