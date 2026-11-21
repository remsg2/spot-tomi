/**
 * Conversion des lignes de get_leaderboard (snake_case) : pur, testé.
 */
import { avatarPublicUrl } from "@/lib/profile/avatar";
import type { LeaderboardEntry } from "./leaderboard";

/** Ligne renvoyée par public.get_leaderboard (colonnes du contrat §6). */
export type LeaderboardRow = {
  user_id: string;
  username: string;
  avatar_path: string | null;
  period: string;
  points: number;
  countries: number;
  stickers: number;
  rank_points: number;
  rank_countries: number;
  rank_stickers: number;
};

export function toEntry(row: LeaderboardRow, supabaseUrl: string): LeaderboardEntry {
  return {
    userId: row.user_id,
    username: row.username,
    avatarUrl: avatarPublicUrl(supabaseUrl, row.avatar_path),
    points: row.points,
    countries: row.countries,
    stickers: row.stickers,
    rankPoints: row.rank_points,
    rankCountries: row.rank_countries,
    rankStickers: row.rank_stickers,
  };
}
