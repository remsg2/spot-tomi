import "server-only";
import { cache } from "react";
import { getMyProfile, getSessionUser, type Profile, type SessionUser } from "@/lib/auth/server";
import { getPublicEnv } from "@/lib/env/server";
import { publicStorageUrl } from "@/lib/map/data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { toPointLines, type SpotPointLineRow } from "./lines";

/** Tout ce que la fiche lieu affiche (spécifications 2.4). */
export type SpotPageData = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  name: string;
  city: string | null;
  countryName: string | null;
  countryTier: string | null;
  year: number;
  color: string;
  takenAt: string;
  altitude: number | null;
  photoUrl: string;
  photoPath: string;
  lat: number | null;
  lng: number | null;
  status: "published" | "pending_review" | "hidden";
  isFirstInCountry: boolean;
  isExceptional: boolean;
  points: number;
  lines: ReturnType<typeof toPointLines>;
};

export type Viewer = { user: SessionUser | null; profile: Profile | null };

/** Utilisateur et profil de la requête (une seule lecture par requête). */
export const getViewer = cache(async (): Promise<Viewer> => {
  try {
    const user = await getSessionUser();
    if (!user) return { user: null, profile: null };
    return { user, profile: await getMyProfile(user.id) };
  } catch {
    // Configuration Supabase absente (build, environnement de test) : visiteur.
    return { user: null, profile: null };
  }
});

/**
 * Score et rang de l'année en cours, d'après la vue leaderboard de l'étape 7.
 * Tant qu'elle n'existe pas (ou sans sticker validé cette année), renvoie null.
 */
export async function getMyScore(userId: string): Promise<{ score: number; rank: number } | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("leaderboard")
      .select("points, rank_points")
      .eq("user_id", userId)
      .eq("period", String(new Date().getFullYear()))
      .maybeSingle<{ points: number | null; rank_points: number | null }>();
    if (error || !data || data.points === null || data.rank_points === null) return null;
    return { score: data.points, rank: data.rank_points };
  } catch {
    return null;
  }
}

type PublicSpotRow = {
  id: string;
  author_id: string;
  author_username: string;
  author_avatar_path: string | null;
  name: string;
  lat: number;
  lng: number;
  altitude_m: number | null;
  taken_at: string;
  year: number;
  color_hex: string;
  country_name_fr: string | null;
  country_tier: string | null;
  city: string | null;
  photo_path: string;
  is_exceptional: boolean;
  is_first_in_country: boolean;
  points_total: number;
};

type OwnSpotRow = {
  id: string;
  author_id: string;
  name: string;
  altitude_m: number | null;
  taken_at: string;
  year: number;
  city: string | null;
  photo_path: string;
  status: SpotPageData["status"];
  is_exceptional: boolean;
  is_first_in_country: boolean;
  points_total: number;
  country: { name_fr: string; tier: string } | null;
};

/**
 * Fiche d'un sticker : d'abord la vue publique (stickers publiés, position
 * publique) ; sinon, pour son auteur ou un modérateur, la table spots (RLS),
 * par exemple un sticker encore en attente. Mise en cache le temps de la requête
 * (métadonnées et page lisent la même chose).
 */
export const getSpotPageData = cache(async (id: string): Promise<SpotPageData | null> => {
  const { supabaseUrl } = await getPublicEnv();
  const supabase = await getSupabaseServerClient();

  const [{ data: spot }, { data: lineRows }] = await Promise.all([
    supabase
      .from("public_spots")
      .select(
        "id, author_id, author_username, author_avatar_path, name, lat, lng, altitude_m, taken_at, year, color_hex, country_name_fr, country_tier, city, photo_path, is_exceptional, is_first_in_country, points_total",
      )
      .eq("id", id)
      .maybeSingle<PublicSpotRow>(),
    supabase
      .from("spot_point_lines")
      .select("rule_key, position, label, detail, points")
      .eq("spot_id", id)
      .order("position", { ascending: true }),
  ]);
  const lines = toPointLines((lineRows ?? []) as SpotPointLineRow[]);

  if (spot) {
    return {
      id: spot.id,
      authorId: spot.author_id,
      authorUsername: spot.author_username,
      authorAvatarUrl: spot.author_avatar_path
        ? publicStorageUrl(supabaseUrl, "avatars", spot.author_avatar_path)
        : null,
      name: spot.name,
      city: spot.city,
      countryName: spot.country_name_fr,
      countryTier: spot.country_tier,
      year: spot.year,
      color: spot.color_hex,
      takenAt: spot.taken_at,
      altitude: spot.altitude_m,
      photoUrl: publicStorageUrl(supabaseUrl, "spot-photos", spot.photo_path),
      photoPath: spot.photo_path,
      lat: spot.lat,
      lng: spot.lng,
      status: "published",
      isFirstInCountry: spot.is_first_in_country,
      isExceptional: spot.is_exceptional,
      points: spot.points_total,
      lines,
    };
  }

  // Pas publié : seul l'auteur (ou un modérateur) le lit, via la RLS de spots.
  const { user } = await getViewer();
  if (!user) return null;
  const { data: own } = await supabase
    .from("spots")
    .select(
      "id, author_id, name, altitude_m, taken_at, year, city, photo_path, status, is_exceptional, is_first_in_country, points_total, country:countries(name_fr, tier)",
    )
    .eq("id", id)
    .maybeSingle<OwnSpotRow>();
  if (!own) return null;

  const [{ data: author }, { data: color }] = await Promise.all([
    supabase.from("public_profiles").select("username, avatar_path").eq("id", own.author_id).maybeSingle<{
      username: string;
      avatar_path: string | null;
    }>(),
    supabase.rpc("year_color", { p_year: own.year }),
  ]);

  return {
    id: own.id,
    authorId: own.author_id,
    authorUsername: author?.username ?? "",
    authorAvatarUrl: author?.avatar_path ? publicStorageUrl(supabaseUrl, "avatars", author.avatar_path) : null,
    name: own.name,
    city: own.city,
    countryName: own.country?.name_fr ?? null,
    countryTier: own.country?.tier ?? null,
    year: own.year,
    color: typeof color === "string" ? color : "#9A9A94",
    takenAt: own.taken_at,
    altitude: own.altitude_m,
    photoUrl: publicStorageUrl(supabaseUrl, "spot-photos", own.photo_path),
    photoPath: own.photo_path,
    lat: null,
    lng: null,
    status: own.status,
    isFirstInCountry: own.is_first_in_country,
    isExceptional: own.is_exceptional,
    points: own.points_total,
    lines,
  };
});
