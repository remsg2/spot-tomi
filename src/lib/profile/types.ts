import type { Badge, MemberStats, PassportStamp } from "@/lib/stats/queries";
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
  /** Passeport : un tampon par pays (cahier des charges 9.1). */
  passport: PassportStamp[];
  badges: Badge[];
  member: MemberStats | null;
  progress: Array<{ day: string; points: number }>;
  /** Nombre de pays au monde (progression du passeport). */
  countriesTotal: number;
};

/** Avis reçu (décision de modération, badge, correction de points). */
export type Notice = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  spotId: string | null;
  createdAt: string;
  readAt: string | null;
};

/** Ligne du journal de points du membre connecté. */
export type LedgerLine = {
  id: number;
  spotId: string | null;
  spotName: string | null;
  year: number | null;
  kind: "spot" | "correction";
  points: number;
  reason: string;
  createdAt: string;
  runningTotal: number;
};
