import { z } from "zod";
import { t } from "@/i18n/fr";

/** Même règle que la contrainte SQL de profiles.username. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_PATTERN, t.profile.usernameInvalid);

export const themeSchema = z.enum(["system", "light", "dark"]);
export type Theme = z.infer<typeof themeSchema>;

export const homeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const passwordSchema = z.string().min(8, t.auth.errors.weak_password);

export const emailSchema = z.email(t.auth.errors.email_address_invalid);

/** Avatar : image de 20 Mo maximum avant réduction côté client. */
export const AVATAR_MAX_BYTES = 20 * 1024 * 1024;
