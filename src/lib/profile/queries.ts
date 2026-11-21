import "server-only";
import { getPublicEnv } from "@/lib/env/server";
import { fetchMemberBadges, fetchMemberStats, fetchPassport, fetchPointsProgress } from "@/lib/stats/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { USERNAME_PATTERN } from "@/lib/validation/profile";
import { avatarPublicUrl } from "./avatar";
import { exactIlikePattern, sinceYear, toAlbumRow, toProfileSpot, type AlbumSqlRow, type SpotSqlRow } from "./mappers";
import type { LedgerLine, Notice, ProfileData, ProfileIdentity } from "./types";

export type { ProfileData, ProfileIdentity, ProfileStats } from "./types";

type PublicProfileRow = { id: string; username: string; avatar_path: string | null; created_at: string };

/** Profil public par pseudo (sans tenir compte de la casse), ou null. */
export async function fetchPublicProfile(username: string): Promise<ProfileIdentity | null> {
  if (!USERNAME_PATTERN.test(username)) return null;
  const [{ supabaseUrl }, supabase] = await Promise.all([getPublicEnv(), getSupabaseServerClient()]);
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, username, avatar_path, created_at")
    .ilike("username", exactIlikePattern(username))
    .maybeSingle<PublicProfileRow>();
  if (error) throw new Error(`public_profiles : ${error.message}`);
  if (!data) return null;
  return {
    userId: data.id,
    username: data.username,
    avatarUrl: avatarPublicUrl(supabaseUrl, data.avatar_path),
    sinceYear: sinceYear(data.created_at),
    role: null,
  };
}

type StatsRow = { points: number; rank: number | null; stickers: number; countries: number; firsts: number };

/**
 * Score, album et stickers d'un utilisateur. Les stickers en attente et masqués
 * ne sont renvoyés par la base que pour son propre profil.
 */
export async function fetchProfileData(userId: string): Promise<ProfileData> {
  const supabase = await getSupabaseServerClient();
  const [stats, album, spots, passport, badges, member, progress, countries] = await Promise.all([
    supabase.rpc("profile_stats", { p_user: userId }).maybeSingle<StatsRow>(),
    supabase.rpc("album", { p_user: userId }),
    supabase.rpc("profile_spots", { p_user: userId }),
    fetchPassport(userId),
    fetchMemberBadges(userId),
    fetchMemberStats(userId),
    fetchPointsProgress(userId),
    supabase.from("countries").select("iso2", { count: "exact", head: true }),
  ]);
  if (stats.error) throw new Error(`profile_stats : ${stats.error.message}`);
  if (album.error) throw new Error(`album : ${album.error.message}`);
  if (spots.error) throw new Error(`profile_spots : ${spots.error.message}`);
  return {
    stats: {
      points: stats.data?.points ?? 0,
      rank: stats.data?.rank ?? null,
      stickers: stats.data?.stickers ?? 0,
      countries: stats.data?.countries ?? 0,
      firsts: stats.data?.firsts ?? 0,
    },
    album: ((album.data ?? []) as AlbumSqlRow[]).map(toAlbumRow),
    spots: ((spots.data ?? []) as SpotSqlRow[]).map(toProfileSpot),
    passport,
    badges,
    member,
    progress,
    countriesTotal: countries.count ?? 0,
  };
}

/** Avis du membre connecté (les plus récents d'abord). */
export async function fetchMyNotices(limit = 20): Promise<Notice[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_notices")
    .select("id, kind, title, body, spot_id, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id as number,
    kind: row.kind as string,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    spotId: (row.spot_id as string | null) ?? null,
    createdAt: row.created_at as string,
    readAt: (row.read_at as string | null) ?? null,
  }));
}

/** Journal de points du membre connecté (my_points_history). */
export async function fetchMyLedger(limit = 30): Promise<LedgerLine[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("my_points_history", { p_limit: limit });
  if (error) return [];
  return ((data ?? []) as Array<{
    id: number;
    spot_id: string | null;
    spot_name: string | null;
    year: number | null;
    kind: "spot" | "correction";
    points: number;
    reason: string;
    created_at: string;
    running_total: number;
  }>).map((row) => ({
    id: row.id,
    spotId: row.spot_id,
    spotName: row.spot_name,
    year: row.year,
    kind: row.kind,
    points: row.points,
    reason: row.reason,
    createdAt: row.created_at,
    runningTotal: row.running_total,
  }));
}
