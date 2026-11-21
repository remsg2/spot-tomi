import "server-only";
import { getPublicEnv } from "@/lib/env/server";
import { publicStorageUrl } from "@/lib/storage";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Statistiques mondiales (rpc world_stats, cahier des charges 8). */
export type WorldStats = {
  stickers: number;
  countries: number;
  countriesTotal: number;
  continents: number;
  continentsTotal: number;
  members: number;
  contributors: number;
  editions: number;
  distanceKm: number;
  topCountries: Array<{ iso2: string; nameFr: string; count: number }>;
  recentConquests: Array<{ iso2: string; nameFr: string; at: string }>;
};

export type RecordKey =
  | "highest"
  | "most_isolated"
  | "rarest"
  | "most_liked"
  | "top_traveler"
  | "longest_distance"
  | "latest_conquest";

/** Un record mondial (rpc world_records) ; absent si la donnée manque. */
export type WorldRecord = {
  key: RecordKey;
  value: number | null;
  detail: string | null;
  spotId: string | null;
  spotName: string | null;
  username: string | null;
  color: string | null;
};

export type ContinentFirst = {
  continent: string;
  label: string;
  spotId: string;
  spotName: string;
  countryName: string | null;
  username: string;
  at: string;
  color: string;
};

export type RarePlace = {
  id: string;
  name: string;
  city: string | null;
  countryName: string | null;
  year: number;
  color: string;
  categoryLabel: string;
  reason: string | null;
  points: number;
  username: string;
  thumbUrl: string | null;
};

export type MemberStats = {
  stickers: number;
  points: number;
  rank: number | null;
  countries: number;
  continents: Array<{ code: string; label: string }>;
  editions: Array<{ year: number; name: string; colorHex: string; count: number }>;
  byCountry: Array<{ iso2: string; nameFr: string; count: number }>;
  highest: { id: string; name: string; altitudeM: number } | null;
  mostIsolated: { id: string; name: string; km: number } | null;
  badges: number;
  likesReceived: number;
};

export type Badge = {
  code: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt: string | null;
  spotId: string | null;
  spotName: string | null;
};

export type PassportStamp = {
  iso2: string;
  nameFr: string;
  continent: string | null;
  continentLabel: string | null;
  firstSpotId: string;
  firstPastedAt: string;
  firstYear: number;
  editionName: string;
  color: string;
  stickers: number;
  points: number;
  pioneer: boolean;
};

export type ConquestCountry = {
  iso2: string;
  nameFr: string;
  continent: string | null;
  spotCount: number;
  firstAt: string | null;
  firstAuthor: string | null;
};

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.rpc(name, args);
    if (error) {
      console.error(`${name} : ${error.message}`);
      return null;
    }
    return data as T;
  } catch {
    // Configuration Supabase absente (build, tests) : rien à afficher.
    return null;
  }
}

export async function fetchWorldStats(): Promise<WorldStats | null> {
  return rpc<WorldStats>("world_stats");
}

export async function fetchWorldRecords(): Promise<WorldRecord[]> {
  const rows = await rpc<
    Array<{
      key: RecordKey;
      value: number | null;
      detail: string | null;
      spot_id: string | null;
      spot_name: string | null;
      username: string | null;
      color_hex: string | null;
    }>
  >("world_records");
  return (rows ?? []).map((row) => ({
    key: row.key,
    value: row.value === null ? null : Number(row.value),
    detail: row.detail,
    spotId: row.spot_id,
    spotName: row.spot_name,
    username: row.username,
    color: row.color_hex,
  }));
}

export async function fetchContinentFirsts(): Promise<ContinentFirst[]> {
  const rows = await rpc<
    Array<{
      continent: string;
      continent_label: string;
      spot_id: string;
      spot_name: string;
      country_name_fr: string | null;
      username: string;
      created_at: string;
      color_hex: string;
    }>
  >("continent_firsts");
  return (rows ?? []).map((row) => ({
    continent: row.continent,
    label: row.continent_label,
    spotId: row.spot_id,
    spotName: row.spot_name,
    countryName: row.country_name_fr,
    username: row.username,
    at: row.created_at,
    color: row.color_hex,
  }));
}

export async function fetchRarestPlaces(limit = 10): Promise<RarePlace[]> {
  const rows = await rpc<
    Array<{
      id: string;
      name: string;
      city: string | null;
      country_name_fr: string | null;
      year: number;
      color_hex: string;
      rarity_label: string;
      rarity_reason: string | null;
      points_total: number;
      author_username: string;
      thumb_path: string | null;
    }>
  >("rarest_places", { p_limit: limit });
  if (!rows) return [];
  const { supabaseUrl } = await getPublicEnv();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    countryName: row.country_name_fr,
    year: row.year,
    color: row.color_hex,
    categoryLabel: row.rarity_label,
    reason: row.rarity_reason,
    points: row.points_total,
    username: row.author_username,
    thumbUrl: row.thumb_path ? publicStorageUrl(supabaseUrl, "spot-photos", row.thumb_path) : null,
  }));
}

export async function fetchMemberStats(userId: string): Promise<MemberStats | null> {
  return rpc<MemberStats>("member_stats", { p_user: userId });
}

export async function fetchPointsProgress(userId: string): Promise<Array<{ day: string; points: number }>> {
  const rows = await rpc<Array<{ day: string; points: number }>>("points_progress", { p_user: userId });
  return rows ?? [];
}

export async function fetchMemberBadges(userId: string): Promise<Badge[]> {
  const rows = await rpc<
    Array<{
      code: string;
      name: string;
      description: string;
      icon: string;
      unlocked: boolean;
      unlocked_at: string | null;
      spot_id: string | null;
      spot_name: string | null;
    }>
  >("member_badges", { p_user: userId });
  return (rows ?? []).map((row) => ({
    code: row.code,
    name: row.name,
    description: row.description,
    icon: row.icon,
    unlocked: row.unlocked,
    unlockedAt: row.unlocked_at,
    spotId: row.spot_id,
    spotName: row.spot_name,
  }));
}

export async function fetchPassport(userId: string): Promise<PassportStamp[]> {
  const rows = await rpc<
    Array<{
      iso2: string;
      name_fr: string;
      continent: string | null;
      continent_label: string | null;
      first_spot_id: string;
      first_pasted_at: string;
      first_year: number;
      edition_name: string;
      color_hex: string;
      stickers: number;
      points: number;
      pioneer: boolean;
    }>
  >("passport", { p_user: userId });
  return (rows ?? []).map((row) => ({
    iso2: row.iso2,
    nameFr: row.name_fr,
    continent: row.continent,
    continentLabel: row.continent_label,
    firstSpotId: row.first_spot_id,
    firstPastedAt: row.first_pasted_at,
    firstYear: row.first_year,
    editionName: row.edition_name,
    color: row.color_hex,
    stickers: row.stickers,
    points: row.points,
    pioneer: row.pioneer,
  }));
}

export async function fetchWorldConquest(): Promise<ConquestCountry[]> {
  const rows = await rpc<
    Array<{
      iso2: string;
      name_fr: string;
      continent: string | null;
      spot_count: number;
      first_at: string | null;
      first_author: string | null;
    }>
  >("world_conquest");
  return (rows ?? []).map((row) => ({
    iso2: row.iso2,
    nameFr: row.name_fr,
    continent: row.continent,
    spotCount: row.spot_count,
    firstAt: row.first_at,
    firstAuthor: row.first_author,
  }));
}

export type FeedItem = {
  id: string;
  name: string;
  city: string | null;
  countryName: string | null;
  year: number;
  editionName: string;
  color: string;
  pastedAt: string;
  createdAt: string;
  photoUrl: string;
  thumbUrl: string | null;
  authorUsername: string;
  points: number;
  rarityCategory: string | null;
  comment: string | null;
  likeCount: number;
  liked: boolean;
};

/** Fil photo : derniers stickers publiés (pagination par date de publication). */
export async function fetchFeed(before: string | null, limit = 20): Promise<FeedItem[] | null> {
  const rows = await rpc<
    Array<{
      id: string;
      name: string;
      city: string | null;
      country_name_fr: string | null;
      year: number;
      edition_name: string;
      color_hex: string;
      taken_at: string;
      created_at: string;
      photo_path: string;
      thumb_path: string | null;
      author_username: string;
      points_total: number;
      rarity_category: string | null;
      comment: string | null;
      like_count: number;
      liked: boolean;
    }>
  >("photo_feed", { p_before: before, p_limit: limit });
  if (!rows) return null;
  const { supabaseUrl } = await getPublicEnv();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    countryName: row.country_name_fr,
    year: row.year,
    editionName: row.edition_name,
    color: row.color_hex,
    pastedAt: row.taken_at,
    createdAt: row.created_at,
    photoUrl: publicStorageUrl(supabaseUrl, "spot-photos", row.photo_path),
    thumbUrl: row.thumb_path ? publicStorageUrl(supabaseUrl, "spot-photos", row.thumb_path) : null,
    authorUsername: row.author_username,
    points: row.points_total,
    rarityCategory: row.rarity_category,
    comment: row.comment,
    likeCount: row.like_count,
    liked: row.liked,
  }));
}

export type AreaEntry = {
  userId: string;
  username: string;
  points: number;
  stickers: number;
  rank: number;
};

export const CONTINENT_CODES = [
  "afrique",
  "amerique_nord",
  "amerique_sud",
  "antarctique",
  "asie",
  "europe",
  "oceanie",
] as const;

/** Zone d'un classement : « continent:europe » ou « pays:FR ». */
export type Zone = { kind: "continent"; code: (typeof CONTINENT_CODES)[number] } | { kind: "country"; code: string };

export function parseZone(value: string | string[] | undefined): Zone | null {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!raw) return null;
  const [kind, code] = raw.split(":");
  if (kind === "continent" && (CONTINENT_CODES as readonly string[]).includes(code)) {
    return { kind: "continent", code: code as Zone["code"] as (typeof CONTINENT_CODES)[number] };
  }
  if (kind === "pays" && /^[A-Za-z]{2}$/.test(code ?? "")) return { kind: "country", code: code.toUpperCase() };
  return null;
}

export function zoneParam(zone: Zone): string {
  return zone.kind === "continent" ? `continent:${zone.code}` : `pays:${zone.code}`;
}

/** Classement d'un pays ou d'un continent (points des stickers publiés dans la zone). */
export async function fetchAreaLeaderboard(zone: Zone, limit = 20): Promise<AreaEntry[] | null> {
  const rows = await rpc<Array<{ user_id: string; username: string; points: number; stickers: number; rank: number }>>(
    "get_area_leaderboard",
    { p_kind: zone.kind, p_code: zone.code, p_limit: limit },
  );
  if (!rows) return null;
  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    points: row.points,
    stickers: row.stickers,
    rank: row.rank,
  }));
}
