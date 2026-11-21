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
import {
  parseCountryTierForm,
  parseExceptionalForm,
  parseModerationForm,
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

  const { spotId, intent } = parsed.data;
  const fn = {
    validate: "admin_validate_spot",
    hide: "admin_hide_spot",
    unhide: "admin_unhide_spot",
    delete: "admin_delete_spot",
  }[intent];
  const { data, error } = await supabase.rpc(fn, { p_spot_id: spotId });
  if (error) return fail(adminErrorMessage(error));
  const spot = data as Spot & { photo_path?: unknown };
  const name = spot.name;

  let message: string;
  if (intent === "delete") {
    // Le sticker est supprimé (et journalisé) : on efface ensuite sa photo,
    // avec la session du modérateur (politique Storage de la migration admin).
    const photoPath = spot.photo_path;
    let removed = false;
    if (typeof photoPath === "string" && photoPath !== "") {
      const { data: files, error: storageError } = await supabase.storage
        .from(SPOT_PHOTOS_BUCKET)
        .remove([photoPath]);
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
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_recompute", { p_spot_id: parsed.data });
  if (error) return fail(adminErrorMessage(error));
  const result = data as { name: string; points_before: number; points_after: number };
  invalidatePublicData();
  return {
    ok: true,
    message: ta.scoring.recomputeOneDone(result.name, Number(result.points_before), Number(result.points_after)),
  };
}

export async function recomputeAllAction(): Promise<ActionResult> {
  const supabase = await sessionClient();
  if (!supabase) return fail(ta.errors.signedOut);

  const { data, error } = await supabase.rpc("admin_recompute", { p_spot_id: null });
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
