import type { GpsSource, SpotStatus } from "./contract";

/**
 * Publication directe (cahier des charges V1.1, section 2) : tout sticker conforme est
 * publié tout de suite. Une position placée à la main le signale seulement « à vérifier »
 * aux modérateurs (create_spot, needs_review), sans le masquer.
 */
export function statusFor(): Extract<SpotStatus, "published"> {
  return "published";
}

/** Le sticker sera-t-il signalé « à vérifier » aux modérateurs ? */
export function needsReview(gpsSource: GpsSource): boolean {
  return gpsSource === "manual";
}

export function isPending(status: SpotStatus): boolean {
  return status !== "published";
}
