import "server-only";
import { getPublicEnv } from "@/lib/env/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { LEADERBOARD_LIMIT, type Criterion, type LeaderboardEntry, type Period } from "./leaderboard";
import { toEntry, type LeaderboardRow } from "./mappers";

export type Season = { year: number; colorHex: string };

/** Saison en cours (couleur de l'année) ; repli : l'année civile, en gris. */
export async function fetchCurrentSeason(): Promise<Season> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .rpc("current_season")
    .maybeSingle<{ year: number; color_hex: string }>();
  if (error || !data) return { year: new Date().getFullYear(), colorHex: "#9A9A94" };
  return { year: data.year, colorHex: data.color_hex };
}

/**
 * Haut du classement d'une période et d'un critère, plus la ligne de
 * l'utilisateur connecté s'il est plus bas, et le nombre de participants.
 */
export async function fetchLeaderboard({
  period,
  criterion,
  userId,
  limit = LEADERBOARD_LIMIT,
}: {
  period: Period;
  criterion: Criterion;
  userId: string | null;
  limit?: number;
}): Promise<{ entries: LeaderboardEntry[]; participants: number }> {
  const [{ supabaseUrl }, supabase] = await Promise.all([getPublicEnv(), getSupabaseServerClient()]);
  const [list, size] = await Promise.all([
    supabase.rpc("get_leaderboard", {
      p_period: period,
      p_criterion: criterion,
      p_limit: limit,
      p_user: userId,
    }),
    supabase.rpc("leaderboard_size", { p_period: period }),
  ]);
  if (list.error) throw new Error(`get_leaderboard : ${list.error.message}`);
  if (size.error) throw new Error(`leaderboard_size : ${size.error.message}`);
  const rows = (list.data ?? []) as LeaderboardRow[];
  return {
    entries: rows.map((row) => toEntry(row, supabaseUrl)),
    participants: typeof size.data === "number" ? size.data : rows.length,
  };
}
