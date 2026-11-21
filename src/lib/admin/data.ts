import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AdminUser,
  AuditEntry,
  CountryRow,
  MissingSeasonYear,
  ModerationEntry,
  ModerationItem,
  ScoringRule,
  Season,
} from "./types";

/*
 * Lectures de l'admin, toujours fraîches (jamais mises en cache) et toujours
 * avec la session de l'utilisateur : les fonctions SQL vérifient son rôle.
 * À appeler après requireStaff(), dans un <Suspense>.
 */

/** Bucket des photos de stickers (étape 5). */
export const SPOT_PHOTOS_BUCKET = "spot-photos";

class AdminDataError extends Error {
  constructor(what: string, code?: string) {
    super(`Lecture admin impossible (${what}${code ? `, ${code}` : ""})`);
    this.name = "AdminDataError";
  }
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args ?? {});
  if (error) throw new AdminDataError(name, error.code);
  return (data ?? []) as T[];
}

function withPhotoUrl(supabase: SupabaseClient, items: ModerationItem[]): ModerationEntry[] {
  return items.map((item) => ({
    ...item,
    photo_url: item.photo_path
      ? supabase.storage.from(SPOT_PHOTOS_BUCKET).getPublicUrl(item.photo_path).data.publicUrl
      : null,
  }));
}

export async function getModerationQueue(): Promise<ModerationEntry[]> {
  const supabase = await getSupabaseServerClient();
  const items = await rpc<ModerationItem>("admin_moderation_queue");
  return withPhotoUrl(supabase, items);
}

export async function searchSpots(query: string): Promise<ModerationEntry[]> {
  const supabase = await getSupabaseServerClient();
  const items = await rpc<ModerationItem>("admin_search_spots", { p_query: query, p_limit: 30 });
  return withPhotoUrl(supabase, items);
}

export async function getModerationCount(): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_moderation_count");
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export async function getSeasons(): Promise<Season[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("year, color_hex, is_current")
    .order("year", { ascending: false });
  if (error) throw new AdminDataError("seasons", error.code);
  return (data ?? []) as Season[];
}

export async function getMissingSeasonYears(): Promise<MissingSeasonYear[]> {
  return rpc<MissingSeasonYear>("admin_missing_season_years");
}

export async function getScoringRules(): Promise<ScoringRule[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.from("scoring_rules").select("key, value, updated_at");
  if (error) throw new AdminDataError("scoring_rules", error.code);
  return ((data ?? []) as Array<{ key: string; value: number | string; updated_at: string }>).map((rule) => ({
    ...rule,
    // numeric arrive parfois en chaîne : toujours un nombre pour le formulaire.
    value: Number(rule.value),
  }));
}

export async function getCountries(): Promise<CountryRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("countries")
    .select("iso2, iso3, name_fr, tier")
    .order("name_fr");
  if (error) throw new AdminDataError("countries", error.code);
  return (data ?? []) as CountryRow[];
}

export async function listUsers(query: string): Promise<AdminUser[]> {
  return rpc<AdminUser>("admin_list_users", { p_query: query || null, p_limit: 200 });
}

export async function getAuditRecent(limit = 100): Promise<AuditEntry[]> {
  return rpc<AuditEntry>("admin_audit_recent", { p_limit: limit });
}
