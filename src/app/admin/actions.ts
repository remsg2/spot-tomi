"use server";

import { refresh, revalidatePath, updateTag } from "next/cache";
import { ta } from "@/i18n/admin.fr";
import { adminErrorMessage } from "@/lib/admin/errors";
import { SPOT_PHOTOS_BUCKET } from "@/lib/admin/data";
import { ruleLabel } from "@/lib/admin/rules";
import type { ActionResult, SeasonActionResult } from "@/lib/admin/types";
import { getSessionUser } from "@/lib/auth/server";
import { SEASON_CACHE_TAG } from "@/lib/season";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { adminBadgesFr, adminEditionsFr } from "@/i18n/admin.fr";
import {
  parseAdjustForm,
  parseBadgeForm,
  parseCountryTierForm,
  parseDeleteUserForm,
  parseEditionForm,
  parseExceptionalForm,
  parseModerationForm,
  parseRarityForm,
  parseReasonForm,
  parseRoleForm,
  parseRuleForm,
  parseSeasonForm,
  parseSpotIdForm,
  parseSuspendForm,
} from "@/lib/validation/admin";

/*
 * Server Actions de l'admin. Ce sont des points d'entrée publics : chacune
 * valide son entrée, vérifie la session, puis appelle une fonction SQL
 * security definer qui contrôle le rôle (is_admin / is_moderator) et
 * journalise l'action. Aucune clé service_role ici.
 */

type Spot = { id: string; name: string; status: string; points_total: number };

const fail = (message: string): ActionResult => ({ ok: false, message });

/** Client lié à la session, ou null si personne n'est connecté. */
async function sessionClient() {
  if (!(await getSessionUser())) return null;
  return getSupabaseServerClient();
}

/**
 * Données publiques modifiées (statut, points, niveaux) : les autres étapes
 * peuvent les avoir mises en cache sous d'autres étiquettes, donc tout le cache
 * de l'app est invalidé. Les actions admin sont rares, le coût est négligeable.
 */
function invalidatePublicData() {
  revalidatePath("/", "layout");
}

// Couleur de l'année ------------------------------------------------------------

export async function applySeasonAction(form: FormData): Promise<SeasonActionResult> {
  const parsed = parseSeasonForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { year, colorHex, makeCurrent } = parsed.data;
  const { error } = await supabase.rpc("admin_set_season", {
    p_year: year,
    p_color_hex: colorHex,
    p_make_current: makeCurrent,
  });
  if (error) return fail(adminErrorMessage(error));

  // Expire tout de suite la couleur mise en cache (src/lib/season.ts) : cette
  // réponse, comme les requêtes suivantes, relit current_season(). Les stickers
  // des années passées dépendent aussi de seasons : le reste du cache suit.
  updateTag(SEASON_CACHE_TAG);
  invalidatePublicData();
  return { ok: true, message: ta.season.applied(year, makeCurrent), color: colorHex, year, makeCurrent };
}

// Modération --------------------------------------------------------------------

export async function moderateSpotAction(form: FormData): Promise<ActionResult> {
  const parsed = parseModerationForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { spotId, intent, reason } = parsed.data;
  const fn = {
    validate: "admin_validate_spot",
    hide: "admin_hide_spot",
    unhide: "admin_unhide_spot",
    delete: "admin_delete_spot",
  }[intent];
  const { data, error } = await supabase.rpc(fn, { p_spot_id: spotId, p_reason: reason });
  if (error) return fail(adminErrorMessage(error));
  const spot = data as Spot & { photo_path?: unknown; thumb_path?: unknown };
  const name = spot.name;

  let message: string;
  if (intent === "delete") {
    // Le sticker est supprimé (et journalisé) : on efface ensuite sa photo et sa
    // miniature, avec la session du modérateur (politique Storage de la migration admin).
    const photoPath = spot.photo_path;
    let removed = false;
    if (typeof photoPath === "string" && photoPath !== "") {
      const paths = [photoPath, typeof spot.thumb_path === "string" ? spot.thumb_path : null].filter(
        (path): path is string => Boolean(path),
      );
      const { data: files, error: storageError } = await supabase.storage.from(SPOT_PHOTOS_BUCKET).remove(paths);
      removed = !storageError && (files?.length ?? 0) > 0;
    }
    message = removed || typeof photoPath !== "string"
      ? ta.moderation.deleted(name)
      : ta.moderation.deletedPhotoKept(name, photoPath);
  } else {
    message =
      intent === "validate"
        ? ta.moderation.validated(spot.name, spot.points_total)
        : intent === "hide"
          ? ta.moderation.hiddenDone(spot.name)
          : ta.moderation.unhiddenDone(spot.name);
  }

  invalidatePublicData();
  return { ok: true, message };
}

export async function setExceptionalAction(form: FormData): Promise<ActionResult> {
  const parsed = parseExceptionalForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_set_exceptional", {
    p_spot_id: parsed.data.spotId,
    p_exceptional: parsed.data.exceptional,
  });
  if (error) return fail(adminErrorMessage(error));
  const spot = data as Spot;
  invalidatePublicData();
  return {
    ok: true,
    message: parsed.data.exceptional
      ? ta.moderation.exceptionalOn(spot.name, spot.points_total)
      : ta.moderation.exceptionalOff(spot.name, spot.points_total),
  };
}

export async function setRarityAction(form: FormData): Promise<ActionResult> {
  const parsed = parseRarityForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_set_rarity", {
    p_spot_id: parsed.data.spotId,
    p_category: parsed.data.category,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(adminErrorMessage(error));
  const spot = data as Spot;
  invalidatePublicData();
  return { ok: true, message: ta.moderation.rarityDone(spot.name, spot.points_total) };
}

// Éditions ------------------------------------------------------------------------

export async function saveEditionAction(form: FormData): Promise<ActionResult> {
  const parsed = parseEditionForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { year, name, colorHex, status, makeCurrent, visualPath } = parsed.data;
  const { error } = await supabase.rpc("admin_save_edition", {
    p_year: year,
    p_name: name,
    p_color_hex: colorHex,
    p_status: status,
    p_make_current: makeCurrent,
    p_visual_path: visualPath,
  });
  if (error) return fail(adminErrorMessage(error));
  updateTag(SEASON_CACHE_TAG);
  invalidatePublicData();
  return { ok: true, message: adminEditionsFr.saved(name) };
}

// Badges --------------------------------------------------------------------------

export async function saveBadgeAction(form: FormData): Promise<ActionResult> {
  const parsed = parseBadgeForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);
  const { error } = await supabase.rpc("admin_set_badge", {
    p_code: parsed.data.code,
    p_active: parsed.data.active,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
  });
  if (error) return fail(adminErrorMessage(error));
  refresh();
  return { ok: true, message: adminBadgesFr.saved(parsed.data.name) };
}

// Barème ------------------------------------------------------------------------

export async function saveRuleAction(form: FormData): Promise<ActionResult> {
  const parsed = parseRuleForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { error } = await supabase.rpc("admin_set_rule", { p_key: parsed.data.key, p_value: parsed.data.value });
  if (error) return fail(adminErrorMessage(error));
  invalidatePublicData();
  return { ok: true, message: ta.scoring.ruleSaved(ruleLabel(parsed.data.key)) };
}

export async function saveCountryTierAction(form: FormData): Promise<ActionResult> {
  const parsed = parseCountryTierForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_set_country_tier", {
    p_iso2: parsed.data.iso2,
    p_tier: parsed.data.tier,
  });
  if (error) return fail(adminErrorMessage(error));
  const country = data as { name_fr: string; tier: string };
  invalidatePublicData();
  return { ok: true, message: ta.scoring.countrySaved(country.name_fr, ta.scoring.tiers[country.tier] ?? country.tier) };
}

export async function recomputeSpotAction(form: FormData): Promise<ActionResult> {
  const parsed = parseSpotIdForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const reason = parseReasonForm(form);
  if (!reason.ok) return fail(reason.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_recompute", { p_spot_id: parsed.data, p_reason: reason.data });
  if (error) return fail(adminErrorMessage(error));
  const result = data as { name: string; points_before: number; points_after: number };
  invalidatePublicData();
  return {
    ok: true,
    message: ta.scoring.recomputeOneDone(result.name, Number(result.points_before), Number(result.points_after)),
  };
}

export async function recomputeAllAction(form: FormData): Promise<ActionResult> {
  const reason = parseReasonForm(form);
  if (!reason.ok) return fail(reason.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_recompute", { p_spot_id: null, p_reason: reason.data });
  if (error) return fail(adminErrorMessage(error));
  const result = data as { count: number; points_before: number; points_after: number };
  invalidatePublicData();
  return {
    ok: true,
    message: ta.scoring.recomputeAllDone(Number(result.count), Number(result.points_before), Number(result.points_after)),
  };
}

// Rôles -------------------------------------------------------------------------

export async function changeRoleAction(form: FormData): Promise<ActionResult> {
  const parsed = parseRoleForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_set_role", {
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return fail(adminErrorMessage(error));
  const user = data as { username: string; role: string };
  refresh();
  return { ok: true, message: ta.roles.roleChanged(user.username, ta.roles.role[user.role] ?? user.role) };
}

export async function setSuspendedAction(form: FormData): Promise<ActionResult> {
  const parsed = parseSuspendForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_suspend", {
    p_user: parsed.data.userId,
    p_suspended: parsed.data.suspended,
  });
  if (error) return fail(adminErrorMessage(error));
  const user = data as { username: string };
  refresh();
  return {
    ok: true,
    message: parsed.data.suspended ? ta.roles.suspended(user.username) : ta.roles.unsuspended(user.username),
  };
}

// Membres : correction de points et suppression de compte ------------------------------------

export async function adjustPointsAction(form: FormData): Promise<ActionResult> {
  const parsed = parseAdjustForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);
  const { data, error } = await supabase.rpc("admin_adjust_points", {
    p_user: parsed.data.userId,
    p_points: parsed.data.points,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(adminErrorMessage(error));
  const result = data as { username: string; points: number };
  invalidatePublicData();
  return { ok: true, message: ta.roles.adjusted(result.username, Number(result.points)) };
}

/**
 * Suppression du compte d'un membre : l'Edge Function delete-account (clé service)
 * vérifie que l'appelant est admin, journalise avec le motif, efface les fichiers
 * Storage puis le compte Auth (profil, stickers, journal partent en cascade).
 */
export async function deleteUserAction(form: FormData): Promise<ActionResult> {
  const parsed = parseDeleteUserForm(form);
  if (!parsed.ok) return fail(parsed.error);
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { userId: parsed.data.userId, reason: parsed.data.reason },
  });
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
    const message = (body as { error?: string } | null)?.error;
    return fail(message ?? ta.roles.deleteFailed);
  }
  invalidatePublicData();
  return { ok: true, message: ta.roles.deletedUser((data as { username?: string } | null)?.username ?? "") };
}
