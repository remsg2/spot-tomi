/**
 * Accès serveur du parcours de publication, derrière une interface : la
 * page réelle utilise Supabase, le banc d'essai /dev/publish des doublures.
 */
import { FunctionsFetchError, FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import type { PublishErrorKey } from "@/i18n/publish.fr";
import {
  estimateSchema,
  PHOTO_BUCKET,
  publishErrorSchema,
  publishResultSchema,
  SQL_ERRORS,
  type DateSource,
  type Estimate,
  type GpsSource,
  type PublishInput,
  type PublishResult,
} from "./contract";

export type EstimateRequest = {
  lat: number;
  lng: number;
  altitude: number | null;
  takenAt: string | null;
  gpsSource: GpsSource;
  dateSource: DateSource;
};

export interface PublishServices {
  estimate(request: EstimateRequest): Promise<Estimate>;
  upload(path: string, photo: Blob): Promise<void>;
  publish(input: PublishInput): Promise<PublishResult>;
}

/** Erreur d'une étape, avec un code traduit par src/i18n/publish.fr.ts. */
export class PublishError extends Error {
  constructor(
    readonly code: PublishErrorKey,
    readonly serverMessage?: string,
  ) {
    super(serverMessage ?? code);
    this.name = "PublishError";
  }
}

/** Erreur SQL (code SQLSTATE) → code d'erreur du parcours. */
export function publishErrorFromSql(code: string | undefined, message?: string): PublishError {
  if (code && SQL_ERRORS[code]) return new PublishError(SQL_ERRORS[code].code, message);
  if (code === "42501" || code === "PGRST301") return new PublishError("unauthorized", message);
  return new PublishError("server_error", message);
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && /fetch|network/i.test(error.message));
}

/**
 * Services Supabase. Le client est obtenu à l'appel (`getClient`) : la
 * configuration n'existe que dans le navigateur, pas pendant le rendu serveur.
 */
export function createSupabaseServices(getClient: () => SupabaseClient): PublishServices {
  return {
    async estimate(request) {
      const { data, error } = await getClient().rpc("estimate_spot_points", {
        p_lat: request.lat,
        p_lng: request.lng,
        p_altitude_m: request.altitude,
        p_taken_at: request.takenAt,
        p_gps_source: request.gpsSource,
        p_date_source: request.dateSource,
      });
      if (error) {
        if (!error.code && isNetworkError(new Error(error.message))) throw new PublishError("network");
        throw publishErrorFromSql(error.code, error.message);
      }
      const parsed = estimateSchema.safeParse(data);
      if (!parsed.success) throw new PublishError("server_error");
      return parsed.data;
    },

    async upload(path, photo) {
      const { error } = await getClient().storage.from(PHOTO_BUCKET).upload(path, photo, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) {
        throw new PublishError(isNetworkError(error) ? "network" : "upload_failed", error.message);
      }
    },

    async publish(input) {
      const { data, error } = await getClient().functions.invoke("publish-spot", { body: input });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const body = await (error.context as Response).json().catch(() => null);
          const parsed = publishErrorSchema.safeParse(body);
          if (parsed.success) throw new PublishError(parsed.data.error.code, parsed.data.error.message);
          throw new PublishError("server_error");
        }
        if (error instanceof FunctionsFetchError) throw new PublishError("network");
        throw new PublishError("server_error");
      }
      const parsed = publishResultSchema.safeParse(data);
      if (!parsed.success) throw new PublishError("server_error");
      return parsed.data;
    },
  };
}
