"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { tm } from "@/i18n/map.fr";
import { getSessionUser } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Résultat d'une action de la fiche lieu, affiché sous le formulaire. */
export type SpotActionState = { ok: boolean; message: string } | null;

const idSchema = z.uuid();
const nameSchema = z.string().trim().min(1).max(80);
const reasonSchema = z.string().trim().max(500);

const errors = tm.spot.errors;

/**
 * L'auteur renomme son sticker. La base n'autorise que la colonne name, et
 * seulement sur ses propres stickers (privilège de colonne et RLS de l'étape 4).
 */
export async function renameSpot(_previous: SpotActionState, formData: FormData): Promise<SpotActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  const name = nameSchema.safeParse(formData.get("name"));
  if (!id.success) return { ok: false, message: errors.generic };
  if (!name.success) return { ok: false, message: errors.nameInvalid };

  const user = await getSessionUser();
  if (!user) return { ok: false, message: errors.loginRequired };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("spots")
    .update({ name: name.data })
    .eq("id", id.data)
    .eq("author_id", user.id)
    .select("id");
  if (error || !data || data.length === 0) return { ok: false, message: errors.notAllowed };

  refresh();
  return { ok: true, message: tm.spot.author.renamed };
}

/** L'auteur supprime son sticker (et sa photo), puis revient à la carte. */
export async function deleteSpot(_previous: SpotActionState, formData: FormData): Promise<SpotActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: errors.generic };

  const user = await getSessionUser();
  if (!user) return { ok: false, message: errors.loginRequired };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("spots")
    .delete()
    .eq("id", id.data)
    .eq("author_id", user.id)
    .select("id, photo_path");
  if (error || !data || data.length === 0) return { ok: false, message: errors.notAllowed };

  // La photo est dans le dossier de l'auteur : sa suppression lui est permise.
  const paths = data.map((row) => row.photo_path as string).filter(Boolean);
  if (paths.length > 0) await supabase.storage.from("spot-photos").remove(paths);

  redirect("/");
}

/** Signalement par un utilisateur connecté, une fois par sticker (clé primaire). */
export async function reportSpot(_previous: SpotActionState, formData: FormData): Promise<SpotActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  const reason = reasonSchema.safeParse(formData.get("reason") ?? "");
  if (!id.success || !reason.success) return { ok: false, message: errors.generic };

  const user = await getSessionUser();
  if (!user) return { ok: false, message: tm.spot.report.login };

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("spot_reports")
    .insert({ spot_id: id.data, reporter_id: user.id, reason: reason.data || null });

  if (error) {
    if (error.code === "23505") return { ok: false, message: tm.spot.report.already };
    if (error.code === "42501") return { ok: false, message: errors.suspended };
    if (/limit|limite/i.test(error.message)) return { ok: false, message: errors.limit };
    return { ok: false, message: errors.generic };
  }
  return { ok: true, message: tm.spot.report.sent };
}
