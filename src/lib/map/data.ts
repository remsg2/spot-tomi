/**
 * Lectures de la carte côté navigateur (client Supabase anonyme ou connecté).
 * Toutes passent par l'API publique : vues et RPC de l'étape 6 (contrats §5).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BboxArgs } from "./bbox";
import type { RpcFilters } from "./filters";
import type { CountryRarity, PublicSpot, SearchResult, Season, SpotCollection } from "./types";

export class MapDataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "MapDataError";
  }
}

function fail(error: { message: string; code?: string } | null): never {
  throw new MapDataError(error?.message ?? "Erreur inconnue", error?.code);
}

export async function fetchSpotsInBbox(
  supabase: SupabaseClient,
  args: BboxArgs,
  filters: RpcFilters,
  signal: AbortSignal,
): Promise<SpotCollection> {
  const { data, error } = await supabase.rpc("spots_in_bbox", { ...args, filters }).abortSignal(signal);
  if (error) fail(error);
  const collection = data as SpotCollection | null;
  if (!collection || !Array.isArray(collection.features)) {
    return { type: "FeatureCollection", features: [] };
  }
  return collection;
}

export async function fetchSeasons(supabase: SupabaseClient): Promise<Season[]> {
  const { data, error } = await supabase
    .from("seasons")
    .select("year, color_hex, is_current")
    .order("year", { ascending: false });
  if (error) fail(error);
  return (data ?? []) as Season[];
}

export async function fetchCountryRarity(supabase: SupabaseClient): Promise<CountryRarity[]> {
  const { data, error } = await supabase.from("country_rarity").select("iso2, tier, base_points, spot_count");
  if (error) fail(error);
  return (data ?? []) as CountryRarity[];
}

/** Colonnes de public_spots utiles à la carte résumée et à la liste de la colonne. */
export const SPOT_CARD_COLUMNS =
  "id, name, city, country_name_fr, author_username, taken_at, year, color_hex, points_total, is_first_in_country, is_exceptional, altitude_m, lat, lng" as const;

export type SpotCard = Pick<
  PublicSpot,
  | "id"
  | "name"
  | "city"
  | "country_name_fr"
  | "author_username"
  | "taken_at"
  | "year"
  | "color_hex"
  | "points_total"
  | "is_first_in_country"
  | "is_exceptional"
  | "altitude_m"
  | "lat"
  | "lng"
>;

export async function fetchSpotCards(
  supabase: SupabaseClient,
  ids: string[],
  signal: AbortSignal,
): Promise<SpotCard[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("public_spots")
    .select(SPOT_CARD_COLUMNS)
    .in("id", ids)
    .abortSignal(signal);
  if (error) fail(error);
  const byId = new Map((data as SpotCard[]).map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter((row): row is SpotCard => Boolean(row));
}

export async function searchSpots(supabase: SupabaseClient, q: string, signal: AbortSignal): Promise<SearchResult[]> {
  const { data, error } = await supabase.rpc("search_spots", { q }).abortSignal(signal);
  if (error) fail(error);
  return (data ?? []) as SearchResult[];
}

/** URL publique d'un fichier Storage (buckets publics spot-photos et avatars). */
export function publicStorageUrl(supabaseUrl: string, bucket: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}
