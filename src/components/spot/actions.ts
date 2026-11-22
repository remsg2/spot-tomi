"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { tm } from "@/i18n/map.fr";
import { photoFr as tp } from "@/i18n/photo.fr";
import { getSessionUser } from "@/lib/auth/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Résultat d'une action de la fiche lieu, affiché sous le formulaire. */
export type SpotActionState = { ok: boolean; message: string } | null;

const idSchema = z.uuid();
const nameSchema = z.string().trim().min(1).max(80);
const reasonSchema = z.string().trim().max(500);
const commentSchema = z.string().max(500);
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const yearSchema = z.coerce.number().int().min(2000).max(2100);
const coordSchema = z.coerce.number().finite();

/** Codes d'erreur de update_my_spot → messages. */
function updateError(code: string | undefined, message: string | undefined): string {
  switch (code) {
    case "ST007":
      return errors.editWindow;
    case "ST008":
      return errors.edition;
    case "ST009":
      return message || errors.date;
    case "ST010":
      return message || errors.tooFar;
    case "ST002":
      return errors.suspended;
    case "ST005":
      return message || errors.generic;
    default:
      return errors.notAllowed;
  }
}

const errors = tm.spot.errors;

/**
 * L'auteur modifie son sticker (rpc update_my_spot) : nom et commentaire à tout moment ;
 * date du collage, édition et position pendant le délai de modification. Les champs
 * absents du formulaire ne changent pas.
 */
export async function updateSpot(_previous: SpotActionState, formData: FormData): Promise<SpotActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: errors.generic };
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) return { ok: false, message: errors.nameInvalid };
  const comment = commentSchema.safeParse(formData.get("comment") ?? "");
  if (!comment.success) return { ok: false, message: errors.commentTooLong };

  const params: Record<string, unknown> = {
    p_spot_id: id.data,
    p_name: name.data,
    p_comment: comment.data,
  };
  if (formData.has("pastedOn")) {
    const day = daySchema.safeParse(formData.get("pastedOn"));
    if (!day.success) return { ok: false, message: errors.date };
    // Midi UTC : le jour saisi ne change dans aucun fuseau.
    params.p_taken_at = `${day.data}T12:00:00.000Z`;
  }
  if (formData.has("year")) {
    const year = yearSchema.safeParse(formData.get("year"));
    if (!year.success) return { ok: false, message: errors.edition };
    params.p_year = year.data;
  }
  if (formData.has("lat") && formData.has("lng")) {
    const lat = coordSchema.safeParse(formData.get("lat"));
    const lng = coordSchema.safeParse(formData.get("lng"));
    if (!lat.success || !lng.success) return { ok: false, message: errors.generic };
    params.p_lat = lat.data;
    params.p_lng = lng.data;
  }

  const user = await getSessionUser();
  if (!user) return { ok: false, message: errors.loginRequired };

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("update_my_spot", params);
  if (error) return { ok: false, message: updateError(error.code, error.message) };

  refresh();
  const changed = (data as { changed?: boolean } | null)?.changed !== false;
  return { ok: true, message: changed ? tm.spot.author.saved : tm.spot.author.unchanged };
}

/** Like ou retrait du like (rpc toggle_like). */
export async function toggleLike(id: string): Promise<{ ok: boolean; liked: boolean; count: number; message?: string }> {
  const spotId = idSchema.safeParse(id);
  if (!spotId.success) return { ok: false, liked: false, count: 0, message: errors.generic };
  const user = await getSessionUser();
  if (!user) return { ok: false, liked: false, count: 0, message: tm.spot.like.login };
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc("toggle_like", { p_spot_id: spotId.data });
  if (error) {
    return { ok: false, liked: false, count: 0, message: error.code === "ST002" ? errors.suspended : errors.generic };
  }
  const result = data as { liked: boolean; count: number };
  return { ok: true, liked: result.liked, count: Number(result.count) };
}

const focusSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).nullable();

/**
 * Cadrage de l'aperçu (rpc set_spot_focus) : point du sticker sur la photo, ou null pour
 * revenir au centre. L'auteur à tout moment, un modérateur aussi (journalisé).
 */
export async function setSpotFocus(id: string, focus: { x: number; y: number } | null): Promise<{ ok: boolean; message: string }> {
  const spotId = idSchema.safeParse(id);
  const point = focusSchema.safeParse(focus);
  if (!spotId.success || !point.success) return { ok: false, message: tp.focus.error };
  if (!(await getSessionUser())) return { ok: false, message: errors.notAllowed };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc("set_spot_focus", {
    p_spot_id: spotId.data,
    p_x: point.data?.x ?? null,
    p_y: point.data?.y ?? null,
  });
  if (error) return { ok: false, message: error.code === "P0002" ? errors.notAllowed : tp.focus.error };
  refresh();
  return { ok: true, message: tp.focus.saved };
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
    .select("id, photo_path, thumb_path");
  if (error || !data || data.length === 0) return { ok: false, message: errors.notAllowed };

  // La photo et la miniature sont dans le dossier de l'auteur : leur suppression lui est permise.
  const paths = data.flatMap((row) => [row.photo_path as string, row.thumb_path as string | null]).filter(
    (path): path is string => Boolean(path),
  );
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
