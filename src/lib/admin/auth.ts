import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getMyProfile, getSessionUser, type Profile, type SessionUser } from "@/lib/auth/server";
import { getPublicEnvResult } from "@/lib/env/server";
import { adminHome, canAccess, staffLevel, type StaffLevel } from "./roles";

export type StaffContext =
  | { status: "signed-out" }
  | { status: "no-profile"; user: SessionUser }
  | { status: "ok"; user: SessionUser; profile: Profile; level: StaffLevel | null };

/** Session et rôle, lus une fois par requête (le layout et la page partagent le résultat). */
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  // Sans configuration Supabase (build locale de test), personne n'est connecté.
  if (!(await getPublicEnvResult()).ok) return { status: "signed-out" };
  const user = await getSessionUser();
  if (!user) return { status: "signed-out" };
  const profile = await getMyProfile(user.id);
  if (!profile) return { status: "no-profile", user };
  return { status: "ok", user, profile, level: staffLevel(profile) };
});

/**
 * Garde côté serveur de chaque page /admin (le proxy ne vérifie que la connexion) :
 * - pas connecté : connexion puis retour ici ; pas de pseudo : page de bienvenue ;
 * - utilisateur sans rôle (ou suspendu) : 404, l'admin n'existe pas pour lui ;
 * - modérateur sur un onglet réservé aux admins : renvoyé vers la modération.
 * Les fonctions SQL revérifient le rôle à chaque lecture et à chaque action.
 */
export async function requireStaff(
  required: StaffLevel,
  nextPath: string,
): Promise<{ user: SessionUser; profile: Profile; level: StaffLevel }> {
  const context = await getStaffContext();
  if (context.status === "signed-out") redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (context.status === "no-profile") redirect(`/welcome?next=${encodeURIComponent(nextPath)}`);
  const { user, profile, level } = context;
  if (!level) notFound();
  if (!canAccess(level, required)) redirect(adminHome(level));
  return { user, profile, level };
}
