"use client";

import { useId } from "react";
import { ta } from "@/i18n/admin.fr";
import type { ActionResult, ModerationEntry } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { ActionMessage } from "./action-message";
import { ConfirmAction } from "./confirm-action";
import {
  buttonDanger,
  buttonGhost,
  buttonYear,
  cardSm,
  dangerBadge,
  goldBadge,
  neutralBadge,
  warnBadge,
} from "./styles";
import { SubmitButton } from "./submit-button";

export type ModerationActions = {
  moderate: (form: FormData) => Promise<ActionResult>;
  setExceptional: (form: FormData) => Promise<ActionResult>;
};

function statusBadge(entry: ModerationEntry) {
  if (entry.status === "hidden") return <span className={neutralBadge}>{ta.moderation.status.hidden}</span>;
  if (entry.status === "pending_review") {
    const label =
      entry.gps_source === "manual"
        ? ta.moderation.status.noGps
        : entry.date_source === "upload"
          ? ta.moderation.status.noDate
          : ta.moderation.status.pending;
    return <span className={warnBadge}>{label}</span>;
  }
  return null;
}

function osmLink(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=17/${lat.toFixed(6)}/${lng.toFixed(6)}`;
}

/**
 * Un sticker de la file de modération (maquette Admin, « À modérer ») :
 * valider, masquer ou démasquer, supprimer avec confirmation, « lieu
 * exceptionnel », et le détail réservé aux modérateurs (photo, position exacte,
 * signalements).
 */
export function ModerationCard({
  entry,
  actions,
  result,
  onResult,
}: {
  entry: ModerationEntry;
  actions: ModerationActions;
  /** Dernier résultat d'action sur ce sticker. */
  result: ActionResult | null;
  onResult: (id: string, result: ActionResult) => void;
}) {
  const ids = useId();
  const title = ta.moderation.by(entry.name, entry.author_username);
  const moved =
    Math.abs(entry.lat - entry.public_lat) > 1e-7 || Math.abs(entry.lng - entry.public_lng) > 1e-7;
  const canValidate = entry.status !== "published" || entry.report_count > 0;

  async function moderate(form: FormData) {
    onResult(entry.id, await actions.moderate(form));
  }
  async function toggleExceptional(form: FormData) {
    onResult(entry.id, await actions.setExceptional(form));
  }

  return (
    <article aria-labelledby={`${ids}-title`} data-spot-id={entry.id} className={cn(cardSm, "flex flex-col gap-2.5")}>
      <div className="flex items-center gap-3">
        <div className="relative size-[52px] shrink-0 overflow-hidden rounded-[12px] bg-soft">
          {entry.photo_url ? (
            // Photo servie par Supabase Storage, dont l'hôte n'est connu qu'au runtime :
            // next/image demanderait de le déclarer au build (remotePatterns).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.photo_url} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="absolute top-3 left-3.5 size-6 -rotate-8 rounded-[4px]"
              style={{ background: entry.color_hex }}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <h3 id={`${ids}-title`} className="truncate text-sm font-bold">
            {title}
          </h3>
          <div className="flex flex-wrap gap-1">
            {statusBadge(entry)}
            {entry.report_count > 0 && <span className={dangerBadge}>{ta.moderation.reported(entry.report_count)}</span>}
            {entry.is_exceptional && <span className={goldBadge}>{ta.moderation.exceptional}</span>}
            {entry.is_first_in_country && <span className={goldBadge}>{ta.moderation.firstInCountry}</span>}
            <span className={neutralBadge}>
              <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-[2px]" style={{ background: entry.color_hex }} />
              {entry.year} · {ta.moderation.points(entry.points_total)}
            </span>
          </div>
        </div>
      </div>

      <form action={moderate} className="flex flex-wrap gap-2">
        <input type="hidden" name="spotId" value={entry.id} />
        {canValidate && (
          <SubmitButton name="intent" value="validate" className={cn(buttonYear, "flex-1")}>
            {ta.moderation.validate}
          </SubmitButton>
        )}
        {entry.status === "hidden" ? (
          <SubmitButton name="intent" value="unhide" className={cn(buttonGhost, "flex-1")}>
            {ta.moderation.unhide}
          </SubmitButton>
        ) : (
          <SubmitButton name="intent" value="hide" className={cn(buttonGhost, "flex-1")}>
            {ta.moderation.hide}
          </SubmitButton>
        )}
        <ConfirmAction
          trigger={ta.moderation.delete}
          question={ta.moderation.confirmDelete}
          confirmLabel={ta.moderation.confirmDeleteYes}
          name="intent"
          value="delete"
          triggerClassName={cn(buttonDanger, "flex-1")}
          confirmClassName={buttonDanger}
        />
      </form>

      <details className="group rounded-[12px] border border-line">
        <summary className="flex min-h-11 cursor-pointer items-center px-3 text-[13px] font-semibold">
          {ta.moderation.details}
        </summary>
        <div className="flex flex-col gap-3 border-t border-line p-3 text-sm">
          {entry.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={entry.photo_url}
              alt={ta.moderation.photoAlt(entry.name)}
              loading="lazy"
              className="max-h-[360px] w-full rounded-[12px] bg-soft object-contain"
            />
          ) : (
            <p className="text-muted">{ta.moderation.noPhoto}</p>
          )}
          <dl className="grid gap-2">
            <div>
              <dt className="text-xs font-bold text-muted">{ta.moderation.exactPosition}</dt>
              <dd className="flex flex-wrap items-center gap-x-3">
                <span className="font-mono">{ta.moderation.coordinates(entry.lat, entry.lng)}</span>
                <a
                  href={osmLink(entry.lat, entry.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                >
                  {ta.moderation.openMap}
                </a>
              </dd>
            </div>
            {moved && (
              <div>
                <dt className="text-xs font-bold text-muted">{ta.moderation.publicPosition}</dt>
                <dd className="font-mono">{ta.moderation.coordinates(entry.public_lat, entry.public_lng)}</dd>
              </div>
            )}
          </dl>
          <div className="text-muted">
            <p>
              {[entry.city, entry.country_name_fr].filter(Boolean).join(", ")}
              {entry.city || entry.country_name_fr ? " · " : ""}
              {ta.moderation.takenAt(entry.taken_at)}
            </p>
            <p>{ta.moderation.sources(entry.gps_source, entry.date_source)}</p>
            {entry.altitude_m !== null && <p>{ta.moderation.altitude(Number(entry.altitude_m))}</p>}
          </div>

          {entry.reports.length > 0 && (
            <section aria-labelledby={`${ids}-reports`} className="flex flex-col gap-1.5">
              <h4 id={`${ids}-reports`} className="text-xs font-bold text-muted">
                {ta.moderation.reportsTitle}
              </h4>
              <ul className="flex flex-col gap-1.5">
                {entry.reports.map((report, index) => (
                  <li key={`${report.created_at}-${index}`} className="rounded-[10px] bg-soft px-2.5 py-1.5">
                    <p className="font-semibold">{report.reason || ta.moderation.reportNoReason}</p>
                    <p className="text-xs text-muted">{ta.moderation.reportBy(report.reporter_username, report.created_at)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form action={toggleExceptional} key={String(entry.is_exceptional)}>
            <input type="hidden" name="spotId" value={entry.id} />
            <label className="flex min-h-11 items-center gap-2.5 font-semibold">
              <input
                type="checkbox"
                name="exceptional"
                defaultChecked={entry.is_exceptional}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                className="size-5 accent-[var(--gold)]"
              />
              {ta.moderation.exceptionalToggle}
            </label>
          </form>
        </div>
      </details>

      <ActionMessage result={result} />
    </article>
  );
}
