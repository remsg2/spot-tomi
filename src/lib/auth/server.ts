import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Theme } from "@/lib/validation/profile";

export type SessionUser = { id: string; email: string | null };

export type Profile = {
  id: string;
  username: string;
  avatar_path: string | null;
  role: "user" | "moderator" | "admin";
  suspended_at: string | null;
  theme: Theme;
  created_at: string;
};

/** Utilisateur connecté, d'après le jeton vérifié (getClaims), ou null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_path, role, suspended_at, theme, created_at")
    .eq("id", userId)
    .maybeSingle<Profile>();
  return data;
}

/** Page réservée aux connectés : sinon, connexion puis retour ici. */
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Page réservée aux comptes qui ont choisi leur pseudo. */
export async function requireProfile(nextPath: string): Promise<{ user: SessionUser; profile: Profile }> {
  const user = await requireUser(nextPath);
  const profile = await getMyProfile(user.id);
  if (!profile) redirect(`/welcome?next=${encodeURIComponent(nextPath)}`);
  return { user, profile };
}
