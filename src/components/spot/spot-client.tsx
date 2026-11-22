"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition, type CSSProperties } from "react";
import { useMapContext } from "@/components/map/map-provider";
import { FlagIcon, PencilIcon, ShareIcon, TrashIcon } from "@/components/map/icons";
import { FocusEditor } from "@/components/photo/focus-editor";
import { PickerPane } from "@/components/publish/picker-pane";
import { HapticTouch, PrimaryButton } from "@/components/ui";
import { tm } from "@/i18n/map.fr";
import { photoFr as tphoto } from "@/i18n/photo.fr";
import { cn } from "@/lib/cn";
import { reportClientError } from "@/lib/errors/report";
import { haptic } from "@/lib/haptics";
import type { PhotoFocus } from "@/lib/photo/focus";
import { distanceMeters, type LatLng } from "@/lib/publish/geo";
import type { EditionOption } from "@/lib/publish/pasted";
import { ACCEPTED_PHOTO_TYPES } from "@/lib/publish/photo";
import type { SpotEditInfo } from "@/lib/spots/server";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { deleteSpot, reportSpot, setSpotFocus, toggleLike, updateSpot, type SpotActionState } from "./actions";

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
      <span className={cn("relative flex", className)}>
        <button
          type="button"
          onClick={share}
          aria-label={tm.spot.share}
          className="flex size-11 items-center justify-center rounded-full bg-card text-text shadow-[0_4px_12px_rgb(0_0_0/0.2)]"
        >
          <ShareIcon />
        </button>
        <HapticTouch onActivate={() => void share()} />
      </span>
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
const fieldClass = "h-12 rounded-[14px] border border-line bg-bg px-3.5 text-[15px] outline-none focus:border-text";

function Feedback({ state }: { state: SpotActionState }) {
  if (!state) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={cn("text-sm font-semibold", state.ok ? "text-text" : "text-[#B42318] dark:text-[#FF8A7A]")}>
      {state.message}
    </p>
  );
}

/** Actions de l'auteur : modifier (nom, commentaire, date, édition, position, photo) ou supprimer. */
export function AuthorActions({
  id,
  name,
  userId,
  info,
  editions,
  commentMax,
  photo,
}: {
  id: string;
  name: string;
  userId: string;
  /** Photo publiée et son repère, pour recadrer l'aperçu (null : sticker masqué ou démo). */
  photo: { url: string; focus: PhotoFocus | null } | null;
  /** Données de modification (rpc my_spot_edit_info) ; null : nom et commentaire seulement. */
  info: SpotEditInfo | null;
  editions: EditionOption[];
  commentMax: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "edit" | "delete" | "focus">("idle");
  const [updateState, updateAction, updating] = useActionState(
    async (previous: SpotActionState, formData: FormData) => {
      const result = await updateSpot(previous, formData);
      if (result?.ok) setMode("idle");
      return result;
    },
    null,
  );
  const [deleteState, deleteAction, deleting] = useActionState(deleteSpot, null);
  const [photoState, setPhotoState] = useState<SpotActionState>(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);

  const [comment, setComment] = useState(info?.comment ?? "");
  const [pastedOn, setPastedOn] = useState(info ? info.takenAt.slice(0, 10) : "");
  const [year, setYear] = useState<number | null>(info?.year ?? null);
  const [point, setPoint] = useState<LatLng | null>(info ? { lat: info.lat, lng: info.lng } : null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const windowOpen = info?.windowOpen ?? false;
  const origin: LatLng | null = info && info.gpsSource !== "manual" ? { lat: info.originLat, lng: info.originLng } : null;
  const moved = info && point ? Math.round(distanceMeters({ lat: info.lat, lng: info.lng }, point)) : 0;
  const choices = info && !editions.some((e) => e.year === info.year)
    ? [...editions, { year: info.year, name: `Édition ${info.year}`, colorHex: "#9A9A94", isCurrent: false }]
    : editions;

  async function changePhoto(file: File) {
    setSendingPhoto(true);
    setPhotoState({ ok: true, message: tm.spot.author.photoSending });
    try {
      const [{ preparePhoto, reencodeToWebp }, { photoHash }, { createSupabaseServices }, contract] = await Promise.all([
        import("@/lib/publish/browser-image"),
        import("@/lib/publish/photo-hash"),
        import("@/lib/publish/services"),
        import("@/lib/publish/contract"),
      ]);
      const prepared = await preparePhoto(file);
      URL.revokeObjectURL(prepared.previewUrl);
      const services = createSupabaseServices(getSupabaseBrowserClient);
      const path = contract.photoPathFor(userId, crypto.randomUUID());
      await services.upload(path, await reencodeToWebp(prepared.decodable));
      let thumbPath: string | null = null;
      try {
        await services.upload(
          contract.thumbPathFor(path),
          await reencodeToWebp(prepared.decodable, { maxSide: contract.THUMB_SIDE, quality: 0.8 }),
        );
        thumbPath = contract.thumbPathFor(path);
      } catch (error) {
        reportClientError("upload", error, "/spots (miniature)");
      }
      await services.replacePhoto?.({
        replaceSpotId: id,
        photoPath: path,
        thumbPath,
        photoHash: await photoHash(prepared.decodable),
      });
      haptic("success");
      setPhotoState({ ok: true, message: tm.spot.author.photoDone });
      router.refresh();
    } catch (error) {
      haptic("error");
      reportClientError("upload", error, "/spots (nouvelle photo)");
      const code = (error as { code?: string } | null)?.code;
      setPhotoState({
        ok: false,
        message: code === "edit_window" ? tm.spot.errors.editWindow : tm.spot.author.photoFailed,
      });
    } finally {
      setSendingPhoto(false);
    }
  }

  return (
    <section aria-labelledby="author-actions" className="flex flex-col gap-3 rounded-[18px] border border-line p-4">
      <h2 id="author-actions" className="font-display text-base font-normal">
        {tm.spot.author.title}
      </h2>
      {mode === "edit" ? (
        <form action={updateAction} className="flex flex-col gap-3" data-testid="edit-spot-form">
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">{tm.spot.author.renameLabel}</span>
            <input
              name="name"
              defaultValue={name}
              required
              maxLength={80}
              autoFocus
              className={fieldClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between text-sm font-semibold">
              {tm.spot.author.commentLabel}
              <span className="font-normal text-muted">{`${comment.trim().length} / ${commentMax}`}</span>
            </span>
            <textarea
              name="comment"
              rows={2}
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              maxLength={500}
              className={cn(fieldClass, "h-auto min-h-[72px] py-2.5")}
            />
          </label>
          {info && (
            <p className="text-xs text-muted">
              {windowOpen ? tm.spot.author.windowOpen(info.editableUntil) : tm.spot.author.windowClosed}
            </p>
          )}
          {info && windowOpen && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">{tm.spot.author.pastedLabel}</span>
                <input
                  type="date"
                  name="pastedOn"
                  value={pastedOn}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setPastedOn(event.currentTarget.value)}
                  className={fieldClass}
                />
              </label>
              {choices.length > 0 && (
                <fieldset className="flex flex-col gap-1.5">
                  <legend className="mb-1.5 text-sm font-semibold">{tm.spot.author.editionLabel}</legend>
                  <input type="hidden" name="year" value={year ?? ""} />
                  <div className="flex flex-wrap gap-2">
                    {choices.map((option) => (
                      <button
                        key={option.year}
                        type="button"
                        role="radio"
                        aria-checked={option.year === year}
                        onClick={() => setYear(option.year)}
                        style={{ "--swatch": option.colorHex } as CSSProperties}
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold",
                          option.year === year ? "border-text bg-text text-bg" : "border-line bg-bg text-text",
                        )}
                      >
                        <span aria-hidden="true" className="size-3.5 rounded-full border border-black/20 bg-(--swatch)" />
                        {option.name}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">{tm.spot.author.positionLabel}</span>
                {point && moved >= 1 && (
                  <>
                    <input type="hidden" name="lat" value={point.lat} />
                    <input type="hidden" name="lng" value={point.lng} />
                  </>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{tm.spot.author.positionValue(moved)}</span>
                  <button type="button" onClick={() => setPickerOpen(true)} className={secondaryButton}>
                    {tm.spot.author.positionAdjust}
                  </button>
                </div>
                {origin && <p className="text-xs text-muted">{tm.spot.author.positionHint(info.radiusM)}</p>}
                <PickerPane
                  overlay
                  open={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  origin={origin}
                  value={point}
                  fallbackCenter={point}
                  radius={info.radiusM}
                  onChange={setPoint}
                />
              </div>
            </>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={updating} className={cn(secondaryButton, "bg-year text-on-year")}>
              {tm.spot.author.renameSave}
            </button>
            <button type="button" onClick={() => setMode("idle")} className={secondaryButton}>
              {tm.spot.author.renameCancel}
            </button>
          </div>
        </form>
      ) : mode === "focus" && photo ? (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-sm font-bold">{tphoto.focus.editTitle}</h3>
          <FocusEditor
            key={photo.url}
            src={photo.url}
            initial={photo.focus}
            save={(focus) => setSpotFocus(id, focus)}
          />
          <button type="button" onClick={() => setMode("idle")} className={cn(secondaryButton, "self-start")}>
            {tm.spot.author.renameCancel}
          </button>
        </div>
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
          <button type="button" onClick={() => setMode("edit")} className={secondaryButton}>
            <PencilIcon size={18} />
            {tm.spot.author.rename}
          </button>
          {windowOpen && (
            <label className={cn(secondaryButton, "cursor-pointer focus-within:outline-3 focus-within:outline-text")}>
              {tm.spot.author.photoChange}
              <input
                type="file"
                accept={ACCEPTED_PHOTO_TYPES}
                className="sr-only"
                disabled={sendingPhoto}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void changePhoto(file);
                }}
              />
            </label>
          )}
          {photo && (
            <button type="button" onClick={() => setMode("focus")} className={secondaryButton}>
              {tphoto.focus.editTitle}
            </button>
          )}
          <button type="button" onClick={() => setMode("delete")} className={secondaryButton}>
            <TrashIcon size={18} />
            {tm.spot.author.delete}
          </button>
        </div>
      )}
      <Feedback state={mode === "delete" ? deleteState : mode === "edit" ? updateState : (photoState ?? updateState)} />
    </section>
  );
}

/** « J'aime » : compteur public, bouton pour les connectés. */
export function LikeButton({
  id,
  initialCount,
  initialLiked,
  canLike,
}: {
  id: string;
  initialCount: number;
  initialLiked: boolean;
  canLike: boolean;
}) {
  const [state, setState] = useState({ count: initialCount, liked: initialLiked });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!canLike) {
      setMessage(tm.spot.like.login);
      return;
    }
    const previous = state;
    // Réponse immédiate, corrigée par le serveur.
    setState({ liked: !previous.liked, count: previous.count + (previous.liked ? -1 : 1) });
    haptic("selection");
    startTransition(async () => {
      const result = await toggleLike(id);
      if (result.ok) setState({ liked: result.liked, count: result.count });
      else {
        setState(previous);
        setMessage(result.message ?? null);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.liked}
        aria-label={tm.spot.like.label(state.count, state.liked)}
        data-testid="like-button"
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold",
          state.liked ? "border-year bg-year text-on-year" : "border-line bg-card text-text",
        )}
      >
        <span aria-hidden="true">{state.liked ? "♥" : "♡"}</span>
        {tm.spot.like.count(state.count)}
      </button>
      {message && (
        <span role="status" className="text-xs font-semibold text-muted">
          {message}
        </span>
      )}
    </div>
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
