/**
 * Edge Function publish-spot (Deno) : publie un sticker dont la photo a déjà
 * été envoyée dans spot-photos/{user_id}/{uuid}.webp.
 *
 * - verify_jwt = false (supabase/config.toml) : le jeton est vérifié ici,
 *   par auth.getUser, pour répondre aussi aux requêtes CORS préalables.
 * - Clé service : SUPABASE_SERVICE_ROLE_KEY, sinon SUPABASE_SECRET_KEYS
 *   (JSON { "default": "sb_secret_…" }). Jamais renvoyée ni journalisée.
 * - Géocodage : GEOCODER_URL (Photon par défaut, Nominatim possible,
 *   « none » pour désactiver), cache en mémoire puis en base.
 * - Altitude du terrain quand la photo n'en a pas : ELEVATION_URL (Open-Meteo par
 *   défaut, « none » pour désactiver).
 * - Mode « nouvelle photo » (corps avec replaceSpotId) : l'auteur remplace la photo de
 *   son sticker pendant le délai de modification.
 */
import { createClient } from "npm:@supabase/supabase-js@2.119.2";
import {
  type CityCache,
  memoryCityCache,
  PHOTON_REVERSE_URL,
  reverseGeocodeCity,
} from "../_shared/geocode.ts";
import { fetchElevation, OPEN_METEO_ELEVATION_URL } from "../_shared/elevation.ts";
import { PHOTO_BUCKET, type PublishResult, type SpotStatus } from "../_shared/publish-contract.ts";
import { handlePublishRequest, type PublishDeps } from "./handler.ts";

function serviceKey(): string {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    try {
      const parsed = JSON.parse(keys) as Record<string, unknown>;
      if (typeof parsed.default === "string" && parsed.default) return parsed.default;
    } catch {
      // Valeur illisible : traitée comme absente.
    }
  }
  throw new Error("Clé service absente (SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SECRET_KEYS).");
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
if (!supabaseUrl) throw new Error("SUPABASE_URL absente.");

const admin = createClient(supabaseUrl, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const geocoderUrl = Deno.env.get("GEOCODER_URL") ?? PHOTON_REVERSE_URL;
const elevationUrl = Deno.env.get("ELEVATION_URL") ?? OPEN_METEO_ELEVATION_URL;
const memory = memoryCityCache();

/** Cache en mémoire de l'instance, puis cache partagé en base (private.geocode_cache). */
const cityCache: CityCache = {
  async get(lat, lng) {
    const local = await memory.get(lat, lng);
    if (local.hit) return local;
    const { data, error } = await admin.rpc("geocode_cache_get", { p_lat: lat, p_lng: lng });
    if (error) throw error;
    const row = Array.isArray(data)
      ? (data[0] as { city: string | null; tourist: boolean | null } | undefined)
      : undefined;
    if (!row) return { hit: false, city: null };
    await memory.put(lat, lng, row.city, "photon", row.tourist);
    return { hit: true, city: row.city, tourist: row.tourist };
  },
  async put(lat, lng, city, provider, tourist = null) {
    await memory.put(lat, lng, city, provider, tourist);
    const { error } = await admin.rpc("geocode_cache_put", {
      p_lat: lat,
      p_lng: lng,
      p_city: city,
      p_provider: provider,
      p_tourist: tourist,
    });
    if (error) throw error;
  },
};

/** Période du classement affiché par défaut : l'année de la saison en cours. */
async function currentPeriod(): Promise<string> {
  const { data } = await admin.rpc("current_season");
  const year = Array.isArray(data) ? (data[0] as { year?: number } | undefined)?.year : undefined;
  return String(year ?? new Date().getUTCFullYear());
}

const deps: PublishDeps = {
  async getUserId(token) {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },

  async downloadPhoto(path) {
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  },

  async removePhoto(path) {
    await admin.storage.from(PHOTO_BUCKET).remove([path]);
  },

  async geocode(lat, lng) {
    if (geocoderUrl === "none") return { city: null, tourist: false };
    const { city, tourist } = await reverseGeocodeCity(lat, lng, { baseUrl: geocoderUrl, cache: cityCache });
    return { city, tourist };
  },

  elevation(lat, lng) {
    return fetchElevation(lat, lng, { baseUrl: elevationUrl });
  },

  async createSpot(args) {
    const { data, error } = await admin.rpc("create_spot", args);
    if (error) return { sqlCode: error.code ?? "", message: error.message ?? "" };
    return { id: data as string };
  },

  async setFocus(args) {
    const { error } = await admin.rpc("set_spot_focus_as", args);
    if (error) throw new Error(`set_spot_focus_as : ${error.message}`);
  },

  async replacePhoto(args) {
    const { data, error } = await admin.rpc("replace_spot_photo", args);
    if (error) return { sqlCode: error.code ?? "", message: error.message ?? "" };
    const row = data as { old_photo_path?: string | null; old_thumb_path?: string | null } | null;
    return { oldPhotoPath: row?.old_photo_path ?? null, oldThumbPath: row?.old_thumb_path ?? null };
  },

  async loadSpot(id) {
    const { data: spot, error } = await admin
      .from("spots")
      .select("id, name, city, year, status, points_total, is_first_in_country, is_exceptional, country_iso2")
      .eq("id", id)
      .single();
    if (error || !spot) throw new Error(`Sticker ${id} introuvable après création.`);

    const [country, color, lines] = await Promise.all([
      spot.country_iso2
        ? admin.from("countries").select("name_fr").eq("iso2", spot.country_iso2).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.rpc("year_color", { p_year: spot.year }),
      admin
        .from("spot_point_lines")
        .select("rule_key, label, detail, points, position")
        .eq("spot_id", id)
        .order("position"),
    ]);

    const result: Pick<PublishResult, "spot" | "lines"> = {
      spot: {
        id: spot.id as string,
        name: spot.name as string,
        city: (spot.city as string | null) ?? null,
        countryNameFr: ((country.data as { name_fr?: string } | null)?.name_fr as string | undefined) ?? null,
        year: spot.year as number,
        colorHex: typeof color.data === "string" ? color.data : "#9A9A94",
        status: spot.status as SpotStatus,
        pointsTotal: spot.points_total as number,
        isFirstInCountry: Boolean(spot.is_first_in_country),
        isExceptional: Boolean(spot.is_exceptional),
      },
      lines: ((lines.data ?? []) as Array<{ rule_key: string; label: string; detail: string | null; points: number }>).map(
        (line) => ({ ruleKey: line.rule_key, label: line.label, detail: line.detail ?? null, points: line.points }),
      ),
    };
    return result;
  },

  async currentRank(userId) {
    // Vue matérialisée de l'étape 7 : absente, l'appel échoue et le rang reste null.
    const period = await currentPeriod();
    const { data, error } = await admin
      .from("leaderboard")
      .select("rank_points")
      .eq("user_id", userId)
      .eq("period", period)
      .maybeSingle();
    if (error || !data) return null;
    const rank = (data as { rank_points?: number | null }).rank_points;
    return typeof rank === "number" ? rank : null;
  },

  async refreshLeaderboard() {
    await admin.rpc("refresh_leaderboard");
  },

  log(message, details) {
    console.error(`[publish-spot] ${message}`, details ?? "");
  },
};

Deno.serve((request) => handlePublishRequest(request, deps));
