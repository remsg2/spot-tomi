"use client";

import { useId, useState } from "react";
import { adminEditionsFr as e } from "@/i18n/admin.fr";
import type { ActionResult, Edition } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { editionVisualUrl } from "@/lib/editions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ActionMessage } from "./action-message";
import { buttonGhost, card, cardSm, input, neutralBadge, sectionTitle, warnBadge } from "./styles";
import { SubmitButton } from "./submit-button";

const EDITIONS_BUCKET = "editions";

/** Envoie le visuel d'une édition dans le bucket « editions » (session admin) ; renvoie son chemin. */
async function uploadVisual(year: number, file: File): Promise<string> {
  const extension = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const path = `${year}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseBrowserClient()
    .storage.from(EDITIONS_BUCKET)
    .upload(path, file, { contentType: file.type || "image/webp", upsert: false });
  if (error) throw error;
  return path;
}

function EditionForm({
  edition,
  action,
  supabaseUrl,
}: {
  /** Null : nouvelle édition. */
  edition: Edition | null;
  action: (form: FormData) => Promise<ActionResult>;
  supabaseUrl: string;
}) {
  const ids = useId();
  const [result, setResult] = useState<ActionResult | null>(null);
  const locked = edition?.color_locked ?? false;
  const visualUrl = edition ? editionVisualUrl(edition.year, edition.visual_path, supabaseUrl) : null;

  async function submit(form: FormData) {
    const file = form.get("visual");
    form.delete("visual");
    if (file instanceof File && file.size > 0) {
      try {
        form.set("visualPath", await uploadVisual(Number(form.get("year")), file));
      } catch {
        setResult({ ok: false, message: e.visualFailed });
        return;
      }
    } else if (form.get("removeVisual") === "on") {
      form.set("visualPath", "");
    }
    form.delete("removeVisual");
    setResult(await action(form));
  }

  return (
    <form
      action={submit}
      className={cn(cardSm, "flex flex-col gap-2.5")}
      data-edition={edition?.year ?? "new"}
      aria-labelledby={`${ids}-title`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={`${ids}-title`} className="text-sm font-bold">
          {edition ? `${edition.name} · ${edition.year}` : e.create}
        </h3>
        {edition?.is_current && <span className={warnBadge}>{e.current}</span>}
        {edition && <span className={neutralBadge}>{e.stickers(edition.spot_count)}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {e.year}
          {edition ? (
            <>
              <input type="hidden" name="year" value={edition.year} />
              <span className="flex min-h-11 items-center text-sm font-bold text-text">{edition.year}</span>
            </>
          ) : (
            <input name="year" type="number" min={2000} max={2100} required className={input} />
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {e.name}
          <input name="name" required maxLength={60} defaultValue={edition?.name ?? ""} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {e.color}
          {locked ? (
            <>
              <input type="hidden" name="colorHex" value={edition?.color_hex} />
              <span className="flex min-h-11 items-center gap-2 text-sm text-text">
                <span aria-hidden="true" className="size-5 rounded-[5px]" style={{ background: edition?.color_hex }} />
                {edition?.color_hex}
              </span>
            </>
          ) : (
            <input
              name="colorHex"
              type="color"
              defaultValue={edition?.color_hex ?? "#5DB043"}
              className="h-11 w-full rounded-[12px] border border-line bg-card"
            />
          )}
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {e.status}
          <select name="status" defaultValue={edition?.status ?? "active"} className={input}>
            <option value="active">{e.statuses.active}</option>
            <option value="archived">{e.statuses.archived}</option>
          </select>
        </label>
      </div>
      {locked && <p className="text-xs text-muted">{e.colorLocked}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {visualUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visualUrl} alt="" className="size-14 rounded-[10px] border border-line object-cover" />
        )}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {e.visual}
          <input name="visual" type="file" accept="image/webp,image/png,image/jpeg" className="text-sm" />
        </label>
        {edition?.visual_path && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="removeVisual" className="size-5" />
            {e.visualRemove}
          </label>
        )}
      </div>
      {!edition?.is_current && (
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="makeCurrent" className="size-5" />
          {e.makeCurrent}
        </label>
      )}
      {edition?.is_current && <input type="hidden" name="makeCurrent" value="on" />}
      <SubmitButton className={cn(buttonGhost, "self-start")}>{e.save}</SubmitButton>
      <ActionMessage result={result} />
    </form>
  );
}

/** Onglet Éditions : liste des éditions et création (cahier des charges, section 6). */
export function EditionsManager({
  editions,
  action,
  supabaseUrl,
}: {
  editions: Edition[];
  action: (form: FormData) => Promise<ActionResult>;
  supabaseUrl: string;
}) {
  return (
    <section aria-labelledby="editions-title" className={cn(card, "flex flex-col gap-3")} data-testid="editions-manager">
      <div className="flex flex-col gap-1">
        <h2 id="editions-title" className={sectionTitle}>
          {e.title}
        </h2>
        <p className="text-xs text-muted">{e.intro}</p>
      </div>
      {editions.length === 0 && <p className="text-sm text-muted">{e.empty}</p>}
      {editions.map((edition) => (
        <EditionForm key={edition.year} edition={edition} action={action} supabaseUrl={supabaseUrl} />
      ))}
      <EditionForm edition={null} action={action} supabaseUrl={supabaseUrl} />
    </section>
  );
}
