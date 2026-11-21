"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n/fr";
import { getSessionUser } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { homeSchema, themeSchema, usernameSchema } from "@/lib/validation/profile";

export type ActionResult = { ok: true } | { ok: false; message: string };

const failure = (message: string): ActionResult => ({ ok: false, message });

function usernameError(code: string | undefined): string {
  if (code === "23505") return t.profile.usernameTaken;
  if (code === "23514") return t.profile.usernameInvalid;
  return t.auth.errors.default;
}

/** Première connexion : crée le profil (pseudo obligatoire) et le domicile éventuel. */
export async function createProfile(input: {
  username: string;
  home: { lat: number; lng: number } | null;
}): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return failure(t.auth.callbackError);

  const username = usernameSchema.safeParse(input.username);
  if (!username.success) return failure(t.profile.usernameInvalid);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("profiles").insert({ id: user.id, username: username.data });
  if (error) return failure(usernameError(error.code));

  if (input.home) {
    const home = homeSchema.safeParse(input.home);
    if (home.success) {
      await supabase.rpc("set_my_home", { lat: home.data.lat, lng: home.data.lng });
    }
  }
  return { ok: true };
}

export async function updateUsername(value: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return failure(t.auth.callbackError);
  const username = usernameSchema.safeParse(value);
  if (!username.success) return failure(t.profile.usernameInvalid);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ username: username.data })
    .eq("id", user.id);
  if (error) return failure(usernameError(error.code));
  revalidatePath("/me", "layout");
  return { ok: true };
}

export async function updateTheme(value: string): Promise<ActionResult> {
  const user = await getSessionUser();
  const theme = themeSchema.safeParse(value);
  if (!user || !theme.success) return failure(t.auth.errors.default);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ theme: theme.data }).eq("id", user.id);
  return error ? failure(t.auth.errors.default) : { ok: true };
}

/** Le domicile est arrondi à ~1 km par la base (set_my_home). */
export async function saveHome(input: { lat: number; lng: number }): Promise<ActionResult> {
  const user = await getSessionUser();
  const home = homeSchema.safeParse(input);
  if (!user || !home.success) return failure(t.auth.errors.default);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("set_my_home", { lat: home.data.lat, lng: home.data.lng });
  return error ? failure(t.auth.errors.default) : { ok: true };
}

export async function clearHome(): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return failure(t.auth.errors.default);
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("clear_my_home");
  return error ? failure(t.auth.errors.default) : { ok: true };
}
