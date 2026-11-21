"use client";

import { useActionState, useEffect, useState } from "react";
import { useMapContext } from "@/components/map/map-provider";
import { FlagIcon, PencilIcon, ShareIcon, TrashIcon } from "@/components/map/icons";
import { PrimaryButton } from "@/components/ui";
import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { deleteSpot, renameSpot, reportSpot, type SpotActionState } from "./actions";

/** Montre le sticker de la fiche sur la carte de droite (tablette et web). */
export function SpotFocus({ id, lng, lat }: { id: string; lng: number | null; lat: number | null }) {
  const { setFocus } = useMapContext();
  useEffect(() => {
    if (lng === null || lat === null) return;
    setFocus({ id, lng, lat });
    return () => setFocus(null);
  }, [id, lng, lat, setFocus]);
  return null;
}

/** Partage par lien : feuille de partage du système, sinon copie du lien. */
export function ShareButton({ name, className }: { name: string; className?: string }) {
  const [status, setStatus] = useState<string | null>(null);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: tm.spot.shareText(name), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setStatus(tm.spot.linkCopied);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus(tm.spot.shareFailed);
    }
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label={tm.spot.share}
        className={cn(
          "flex size-11 items-center justify-center rounded-full bg-card text-text shadow-[0_4px_12px_rgb(0_0_0/0.2)]",
          className,
        )}
      >
        <ShareIcon />
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>
      {status && (
        <span className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-band px-4 py-2 text-sm font-semibold text-white shadow-card-lg">
          {status}
        </span>
      )}
    </>
  );
}

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] bg-soft px-4 text-sm font-semibold text-text disabled:opacity-60";

function Feedback({ state }: { state: SpotActionState }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm font-semibold", state.ok ? "text-text" : "text-[#B42318] dark:text-[#FF8A7A]")}>
      {state.message}
    </p>
  );
}

/** Actions de l'auteur : renommer ou supprimer son sticker. */
export function AuthorActions({ id, name }: { id: string; name: string }) {
  const [mode, setMode] = useState<"idle" | "rename" | "delete">("idle");
  const [renameState, renameAction, renaming] = useActionState(
    async (previous: SpotActionState, formData: FormData) => {
      const result = await renameSpot(previous, formData);
      if (result?.ok) setMode("idle");
      return result;
    },
    null,
  );
  const [deleteState, deleteAction, deleting] = useActionState(deleteSpot, null);

  return (
    <section aria-labelledby="author-actions" className="flex flex-col gap-3 rounded-[18px] border border-line p-4">
      <h2 id="author-actions" className="font-display text-base font-normal">
        {tm.spot.author.title}
      </h2>
      {mode === "rename" ? (
        <form action={renameAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{tm.spot.author.renameLabel}</span>
            <input
              name="name"
              defaultValue={name}
              required
              maxLength={80}
              autoFocus
              className="h-12 rounded-[14px] border border-line bg-bg px-3.5 text-[15px] outline-none focus:border-text"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={renaming} className={cn(secondaryButton, "bg-year text-on-year")}>
              {tm.spot.author.renameSave}
            </button>
            <button type="button" onClick={() => setMode("idle")} className={secondaryButton}>
              {tm.spot.author.renameCancel}
            </button>
          </div>
        </form>
      ) : mode === "delete" ? (
        <form action={deleteAction} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm">{tm.spot.author.deleteConfirm}</p>
          <div className="flex gap-2">
            <button type="submit" disabled={deleting} className={cn(secondaryButton, "bg-[#B42318] text-white")}>
              {deleting ? tm.spot.author.deleting : tm.spot.author.deleteYes}
            </button>
            <button type="button" onClick={() => setMode("idle")} className={secondaryButton}>
              {tm.spot.author.deleteNo}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode("rename")} className={secondaryButton}>
            <PencilIcon size={18} />
            {tm.spot.author.rename}
          </button>
          <button type="button" onClick={() => setMode("delete")} className={secondaryButton}>
            <TrashIcon size={18} />
            {tm.spot.author.delete}
          </button>
        </div>
      )}
      <Feedback state={mode === "delete" ? deleteState : renameState} />
    </section>
  );
}

/** Signalement d'un sticker par un utilisateur connecté (spot_reports). */
export function ReportForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reportSpot, null);

  if (state?.ok) return <Feedback state={state} />;

  return open ? (
    <form action={action} className="flex flex-col gap-3 rounded-[18px] border border-line p-4">
      <input type="hidden" name="id" value={id} />
      <h2 className="font-display text-base font-normal">{tm.spot.report.title}</h2>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{tm.spot.report.reason}</span>
        <textarea
          name="reason"
          maxLength={500}
          rows={3}
          placeholder={tm.spot.report.reasonPlaceholder}
          className="rounded-[14px] border border-line bg-bg px-3.5 py-2.5 text-[15px] outline-none focus:border-text"
        />
      </label>
      <div className="flex gap-2">
        <PrimaryButton type="submit" disabled={pending} className="min-h-12 flex-1 text-sm">
          {tm.spot.report.submit}
        </PrimaryButton>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
          {tm.spot.report.cancel}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  ) : (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen(true)} className={cn(secondaryButton, "self-start")}>
        <FlagIcon size={18} />
        {tm.spot.report.button}
      </button>
      <Feedback state={state} />
    </div>
  );
}
