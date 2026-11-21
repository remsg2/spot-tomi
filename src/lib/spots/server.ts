import "server-only";
import { cache } from "react";
import { getMyProfile, getSessionUser, type Profile, type SessionUser } from "@/lib/auth/server";
import { getPublicEnv } from "@/lib/env/server";
import { editionVisualUrl } from "@/lib/editions";
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
  comment: string | null;
  editionName: string;
  /** Visuel officiel du sticker de l'édition (fiche sans photo). */
  editionVisualUrl: string | null;
  rarityCategory: string | null;
  rarityReason: string | null;
};

/** Sticker proche, sur la fiche (rpc nearby_spots). */
export type NearbySpot = {
  id: string;
  name: string;
  city: string | null;
  countryName: string | null;
  year: number;
  color: string;
  points: number;
  thumbUrl: string | null;
  distanceM: number;
};

/** Formulaire de modification de l'auteur (rpc my_spot_edit_info). */
export type SpotEditInfo = {
  id: string;
  name: string;
  comment: string | null;
  year: number;
  takenAt: string;
  gpsSource: "exif" | "device" | "manual";
  lat: number;
  lng: number;
  originLat: number;
  originLng: number;
  radiusM: number;
  createdAt: string;
  editableUntil: string;
  /** Fenêtre de modification encore ouverte (horloge du serveur). */
  windowOpen: boolean;
  needsReview: boolean;
  status: SpotPageData["status"];
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
    // Même source que la page profil (étape 7) : score et rang « depuis toujours ».
    // La vue matérialisée leaderboard n'est pas lisible directement.
    const { data, error } = await supabase
      .rpc("profile_stats", { p_user: userId })
      .maybeSingle<{ points: number | null; rank: number | null }>();
    if (error || !data || data.points === null || data.rank === null) return null;
    return { score: data.points, rank: data.rank };
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
  comment: string | null;
  edition_name: string;
  rarity_category: string | null;
  rarity_reason: string | null;
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
  comment: string | null;
  rarity_category: string | null;
  rarity_reason: string | null;
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
        "id, author_id, author_username, author_avatar_path, name, lat, lng, altitude_m, taken_at, year, color_hex, country_name_fr, country_tier, city, photo_path, is_exceptional, is_first_in_country, points_total, comment, edition_name, rarity_category, rarity_reason",
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
      comment: spot.comment,
      editionName: spot.edition_name ?? `Édition ${spot.year}`,
      editionVisualUrl: editionVisualUrl(spot.year, null, null),
      rarityCategory: spot.rarity_category,
      rarityReason: spot.rarity_reason,
    };
  }

  // Pas publié : seul l'auteur (ou un modérateur) le lit, via la RLS de spots.
  const { user } = await getViewer();
  if (!user) return null;
  const { data: own } = await supabase
    .from("spots")
    .select(
      "id, author_id, name, altitude_m, taken_at, year, city, photo_path, status, is_exceptional, is_first_in_country, points_total, comment, rarity_category, rarity_reason, country:countries(name_fr, tier)",
    )
    .eq("id", id)
    .maybeSingle<OwnSpotRow>();
  if (!own) return null;

  const [{ data: author }, { data: color }, { data: edition }] = await Promise.all([
    supabase.from("public_profiles").select("username, avatar_path").eq("id", own.author_id).maybeSingle<{
      username: string;
      avatar_path: string | null;
    }>(),
    supabase.rpc("year_color", { p_year: own.year }),
    supabase.from("seasons").select("name").eq("year", own.year).maybeSingle<{ name: string }>(),
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
    comment: own.comment,
    editionName: edition?.name ?? `Édition ${own.year}`,
    editionVisualUrl: editionVisualUrl(own.year, null, null),
    rarityCategory: own.rarity_category,
    rarityReason: own.rarity_reason,
  };
});

/** Stickers publiés les plus proches (50 km au plus), du plus proche au plus loin. */
export async function getNearbySpots(id: string, limit = 6): Promise<NearbySpot[]> {
  try {
    const { supabaseUrl } = await getPublicEnv();
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.rpc("nearby_spots", { p_spot_id: id, p_limit: limit });
    return ((data ?? []) as Array<{
      id: string;
      name: string;
      city: string | null;
      country_name_fr: string | null;
      year: number;
      color_hex: string;
      points_total: number;
      thumb_path: string | null;
      distance_m: number;
    }>).map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      countryName: row.country_name_fr,
      year: row.year,
      color: row.color_hex,
      points: row.points_total,
      thumbUrl: row.thumb_path ? publicStorageUrl(supabaseUrl, "spot-photos", row.thumb_path) : null,
      distanceM: row.distance_m,
    }));
  } catch {
    return [];
  }
}

/** Likes d'un sticker et « liké par moi ». */
export async function getLikeInfo(id: string): Promise<{ count: number; liked: boolean }> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.rpc("spot_like_info", { p_spot_id: id });
    const info = data as { count?: number; liked?: boolean } | null;
    return { count: Number(info?.count ?? 0), liked: Boolean(info?.liked) };
  } catch {
    return { count: 0, liked: false };
  }
}

/** Données du formulaire de modification, pour l'auteur seulement (sinon null). */
export async function getSpotEditInfo(id: string): Promise<SpotEditInfo | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.rpc("my_spot_edit_info", { p_spot_id: id });
    return (data as SpotEditInfo | null) ?? null;
  } catch {
    return null;
  }
}
