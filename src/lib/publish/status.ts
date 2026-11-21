import type { DateSource, GpsSource, SpotStatus } from "./contract";

/**
 * Statut d'un sticker à sa publication (spécifications 2.2 et 3.3), même règle
 * que create_spot : sans GPS ou sans date dans la photo, un modérateur le
 * vérifie d'abord et ses points restent en attente.
 */
export function statusFor(gpsSource: GpsSource, dateSource: DateSource): Extract<SpotStatus, "published" | "pending_review"> {
  return gpsSource === "manual" || dateSource === "upload" ? "pending_review" : "published";
}

export function isPending(status: SpotStatus): boolean {
  return status !== "published";
}
