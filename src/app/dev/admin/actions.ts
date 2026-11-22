"use server";

import { ta } from "@/i18n/admin.fr";
import type { ActionResult, SeasonActionResult } from "@/lib/admin/types";
import { getPublicEnvResult } from "@/lib/env/server";
import { parseModerationForm, parseRarityForm, parseSeasonForm } from "@/lib/validation/admin";

/*
 * Actions simulées de la page /dev/admin : même validation que les vraies
 * (src/app/admin/actions.ts), mais rien n'est écrit. Refusées en production.
 */

async function devOnly(): Promise<boolean> {
  const env = await getPublicEnvResult();
  return (env.ok ? env.env.appEnv : env.appEnv) !== "production";
}

export async function previewSeasonAction(form: FormData): Promise<SeasonActionResult> {
  if (!(await devOnly())) return { ok: false, message: ta.errors.forbidden };
  const parsed = parseSeasonForm(form);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const { year, colorHex, makeCurrent } = parsed.data;
  return { ok: true, message: ta.season.applied(year, makeCurrent), color: colorHex, year, makeCurrent };
}

export async function previewModerationAction(form: FormData): Promise<ActionResult> {
  if (!(await devOnly())) return { ok: false, message: ta.errors.forbidden };
  const parsed = parseModerationForm(form);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  return { ok: true, message: `Simulation : ${parsed.data.intent}` };
}

export async function previewExceptionalAction(): Promise<ActionResult> {
  if (!(await devOnly())) return { ok: false, message: ta.errors.forbidden };
  return { ok: true, message: "Simulation : site remarquable" };
}

export async function previewFocusAction(_spotId: string, focus: { x: number; y: number } | null): Promise<ActionResult> {
  if (!(await devOnly())) return { ok: false, message: ta.errors.forbidden };
  return { ok: true, message: focus ? `Simulation : cadrage ${focus.x}, ${focus.y}` : "Simulation : cadrage au centre" };
}

export async function previewRarityAction(form: FormData): Promise<ActionResult> {
  if (!(await devOnly())) return { ok: false, message: ta.errors.forbidden };
  const parsed = parseRarityForm(form);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  return { ok: true, message: `Simulation : catégorie ${parsed.data.category ?? "automatique"}` };
}
