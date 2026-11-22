"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { FocusPicker } from "@/components/photo/focus-picker";
import { formatCoordinates, tp, type PublishErrorKey } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import type { PhotoFocus } from "@/lib/photo/focus";
import type { PreparedPhoto } from "@/lib/publish/browser-image";
import { PLACE_NAME_MAX } from "@/lib/publish/contract";
import { isAppleMobile } from "@/lib/publish/device-position";
import { distanceMeters, type LatLng } from "@/lib/publish/geo";
import type { EditionOption, PastedError } from "@/lib/publish/pasted";
import { EstimatePanel, type EstimateState } from "./estimate-panel";
import { FlowHeader } from "./flow-header";
import { AlertIcon, CheckIcon, LockIcon, PinIcon } from "./icons";
import { PickerPane } from "./picker-pane";
import { StickButton } from "./stick-button";

export type PositionState = {
  /**
   * exif : position de la photo ; device : position du téléphone, photo prise à
   * l'instant (toutes deux ajustables de `radius` m) ; manual : placée sur la carte.
   */
  source: "exif" | "device" | "manual";
  origin: LatLng | null;
  point: LatLng | null;
  /** Altitude de la source (photo ou téléphone), jamais pour une position manuelle. */
  altitude: number | null;
};

const noSubscription = () => () => {};

export type NameError = keyof typeof tp.review.errors;

type Props = {
  photo: PreparedPhoto;
  position: PositionState;
  onPositionChange: (point: LatLng) => void;
  editRadius: number;
  fallbackCenter: LatLng | null;
  /** La date proposée vient-elle de la photo ? */
  dateFromPhoto: boolean;
  pastedOn: string;
  onPastedChange: (value: string) => void;
  dateError: PastedError | null;
  /** Aujourd'hui (« 2026-11-21 ») : date maximale. */
  today: string;
  editions: EditionOption[];
  edition: number | null;
  onEditionChange: (year: number) => void;
  /** Position placée à la main : publié, puis vérifié par un modérateur. */
  needsReview: boolean;
  /** Point du sticker sur la photo (null : centre). */
  focus: PhotoFocus | null;
  onFocusChange: (focus: PhotoFocus | null) => void;
  comment: string;
  commentMax: number;
  onCommentChange: (value: string) => void;
  name: string;
  onNameChange: (name: string) => void;
  nameError: NameError | null;
  estimate: EstimateState;
  /** Publication impossible (suspension, limite…) : message affiché, bouton désactivé. */
  blocked: PublishErrorKey | null;
  onChangePhoto: () => void;
  onSubmit: () => void;
};

function CheckRow({
  tone,
  icon,
  label,
  value,
  action,
}: {
  tone: "ok" | "todo";
  icon: ReactNode;
  label: string;
  value: string;
  action?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-line py-[9px]">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-[26px] shrink-0 items-center justify-center rounded-[8px]",
          tone === "ok" ? "bg-year text-on-year" : "bg-soft text-text",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-sm font-semibold break-words">{value}</span>
      </div>
      {action}
    </li>
  );
}

/** Étape 2 / 3 : vérification de la position, de la date et du nom, avec l'estimation des points. */
export function ReviewStep(props: Props) {
  const { photo, position, estimate, blocked } = props;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameId = useId();
  const nameErrorId = useId();
  const dateId = useId();
  const dateHintId = useId();
  const commentId = useId();
  const editionLabelId = useId();
  const country = estimate.kind === "ready" ? estimate.data.countryNameFr : null;
  const point = position.point;
  const moved = position.origin && point ? Math.round(distanceMeters(position.origin, point)) : 0;
  const appleMobile = useSyncExternalStore(noSubscription, isAppleMobile, () => false);
  const nearest = estimate.kind === "ready" ? estimate.data.nearest : null;
  const commentLength = props.comment.trim().length;
  const dateMessage =
    props.dateError === "future"
      ? tp.review.pastedFuture
      : props.dateError === "before_edition" && props.edition !== null
        ? tp.review.pastedBeforeEdition(props.edition)
        : props.dateError
          ? tp.review.errors.date_invalid
          : null;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!point) {
      setPositionMissing(true);
      setPickerOpen(true);
      return;
    }
    props.onSubmit();
  }

  const actionClass =
    "flex min-h-11 shrink-0 items-center rounded-full px-3 text-[13px] font-bold underline decoration-2 underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text lg:hidden";

  let positionRow: ReactNode;
  if (position.source !== "manual" && point) {
    const coords = formatCoordinates(point.lat, point.lng);
    positionRow = (
      <CheckRow
        tone="ok"
        icon={<CheckIcon size={16} />}
        label={position.source === "device" ? tp.review.deviceLabel : tp.review.gpsLabel}
        value={`${tp.review.gpsValue(country, coords)}${moved >= 1 ? ` · ${tp.review.gpsMoved(moved)}` : ""}`}
        action={
          <button type="button" className={actionClass} onClick={() => setPickerOpen(true)}>
            {tp.review.adjust}
          </button>
        }
      />
    );
  } else {
    positionRow = (
      <CheckRow
        tone={point ? "ok" : "todo"}
        icon={point ? <PinIcon size={15} /> : <AlertIcon size={15} />}
        label={tp.review.manualLabel}
        value={point ? tp.review.manualValue(country, formatCoordinates(point.lat, point.lng)) : tp.review.manualMissing}
        action={
          <button type="button" className={actionClass} onClick={() => setPickerOpen(true)}>
            {point ? tp.review.move : tp.review.place}
          </button>
        }
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col lg:grid lg:h-dvh lg:grid-cols-[440px_minmax(0,1fr)]">
      <form
        noValidate
        onSubmit={submit}
        className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-3.5 px-4 pt-4 lg:mx-0 lg:max-w-none lg:overflow-y-auto lg:border-r lg:border-line lg:bg-card lg:px-6 lg:pt-[22px]"
      >
        <FlowHeader step={2} />
        <h2 ref={headingRef} tabIndex={-1} className="sr-only">
          {tp.review.checksLabel}
        </h2>

        {/* Photo entière (aperçu local blob:, jamais envoyé tel quel) : toucher le sticker. */}
        <FocusPicker
          src={photo.previewUrl}
          value={props.focus}
          onChange={props.onFocusChange}
          overlay={
            <button
              type="button"
              onClick={props.onChangePhoto}
              className="absolute bottom-3 left-3 h-[34px] rounded-full bg-black/60 px-3 text-xs font-semibold text-white after:absolute after:-inset-[5px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {tp.review.changePhoto}
            </button>
          }
        />

        <div className="flex flex-col rounded-[20px] border border-line bg-card px-3.5 py-1.5 lg:bg-bg">
          <ul aria-label={tp.review.checksLabel}>
            {positionRow}
          </ul>
          <div className="flex items-center gap-3 py-2.5">
            <span aria-hidden="true" className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] bg-soft text-text">
              <LockIcon size={15} />
            </span>
            <span className="text-xs leading-[1.35] text-muted">{tp.review.privacy}</span>
          </div>
        </div>

        {props.needsReview && point && (
          <p className="text-xs leading-[1.4] text-muted">{tp.review.manualReviewNotice}</p>
        )}
        {nearest && (
          <p
            data-testid="nearby-warning"
            className={cn(
              "flex items-start gap-2 rounded-[14px] border border-line p-3 text-xs leading-[1.4]",
              nearest.distanceM < 200 ? "bg-card font-semibold" : "text-muted",
            )}
          >
            {nearest.distanceM < 200 && <AlertIcon size={15} className="mt-px shrink-0" />}
            {nearest.mine && nearest.distanceM < 200
              ? tp.review.nearbyOwn(nearest.distanceM, nearest.name)
              : nearest.distanceM < 200
                ? tp.review.nearbyDuplicate(nearest.distanceM, nearest.name)
                : tp.review.nearbyInfo(nearest.distanceM)}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={dateId} className="text-xs font-bold text-muted">
            {tp.review.pastedLabel}
          </label>
          <input
            id={dateId}
            type="date"
            name="pastedOn"
            required
            max={props.today}
            value={props.pastedOn}
            onChange={(event) => props.onPastedChange(event.currentTarget.value)}
            aria-invalid={dateMessage ? true : undefined}
            aria-describedby={dateHintId}
            className="h-12 rounded-[14px] border border-line bg-card px-3.5 text-[15px] font-semibold text-text focus:outline-3 focus:outline-offset-1 focus:outline-text aria-invalid:border-text"
          />
          <p id={dateHintId} className={cn("text-xs", dateMessage ? "font-bold" : "text-muted")}>
            {dateMessage ?? (props.dateFromPhoto ? tp.review.pastedFromPhoto : tp.review.pastedFromToday)}
          </p>
        </div>

        {props.editions.length > 0 && (
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-labelledby={editionLabelId}>
            <span id={editionLabelId} className="text-xs font-bold text-muted">
              {tp.review.editionLabel}
            </span>
            <div className="flex flex-wrap gap-2">
              {props.editions.map((option) => {
                const selected = option.year === props.edition;
                return (
                  <button
                    key={option.year}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-edition={option.year}
                    onClick={() => props.onEditionChange(option.year)}
                    style={{ "--swatch": option.colorHex } as CSSProperties}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text",
                      selected ? "border-text bg-text text-bg" : "border-line bg-card text-text",
                    )}
                  >
                    {option.visualUrl ? (
                      // Visuel officiel du sticker de l'édition (public/editions).
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={option.visualUrl} alt="" width={28} height={28} className="size-7 shrink-0 rounded-[6px]" />
                    ) : (
                      <span aria-hidden="true" className="size-3.5 shrink-0 rounded-full border border-black/20 bg-(--swatch)" />
                    )}
                    {tp.review.editionOption(option.name, option.year)}
                    {option.isCurrent && <span className="text-[11px] font-bold opacity-70">{tp.review.editionCurrent}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted">{tp.review.editionHint}</p>
          </div>
        )}
        {position.source === "manual" && appleMobile && (
          <p data-testid="ios-location-tip" className="text-xs leading-[1.4] font-semibold text-muted">
            {tp.review.iosTip}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={nameId} className="text-xs font-bold text-muted">
              {tp.review.nameLabel}
            </label>
            <span className="text-xs text-muted" aria-hidden="true">
              {tp.review.nameCount(props.name.length, PLACE_NAME_MAX)}
            </span>
          </div>
          <input
            id={nameId}
            type="text"
            name="name"
            required
            maxLength={PLACE_NAME_MAX}
            autoComplete="off"
            enterKeyHint="done"
            value={props.name}
            placeholder={tp.review.namePlaceholder}
            onChange={(event) => props.onNameChange(event.currentTarget.value)}
            aria-invalid={props.nameError ? true : undefined}
            aria-describedby={props.nameError ? nameErrorId : undefined}
            className="h-12 rounded-[14px] border border-line bg-card px-3.5 text-[15px] font-semibold text-text placeholder:font-medium placeholder:text-muted focus:outline-3 focus:outline-offset-1 focus:outline-text aria-invalid:border-text"
          />
          {props.nameError && (
            <p id={nameErrorId} className="text-xs font-bold">
              {tp.review.errors[props.nameError]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={commentId} className="text-xs font-bold text-muted">
              {tp.review.commentLabel}
            </label>
            <span className={cn("text-xs", commentLength > props.commentMax ? "font-bold" : "text-muted")} aria-hidden="true">
              {tp.review.commentCount(commentLength, props.commentMax)}
            </span>
          </div>
          <textarea
            id={commentId}
            name="comment"
            rows={2}
            value={props.comment}
            placeholder={tp.review.commentPlaceholder}
            onChange={(event) => props.onCommentChange(event.currentTarget.value)}
            aria-invalid={commentLength > props.commentMax ? true : undefined}
            className="min-h-[72px] resize-y rounded-[14px] border border-line bg-card px-3.5 py-2.5 text-[15px] text-text placeholder:text-muted focus:outline-3 focus:outline-offset-1 focus:outline-text aria-invalid:border-text"
          />
          {commentLength > props.commentMax && (
            <p className="text-xs font-bold">{tp.review.commentTooLong(props.commentMax)}</p>
          )}
        </div>

        <EstimatePanel state={estimate} pending={false} />

        <div className="flex flex-col gap-2 rounded-[18px] border border-line bg-card p-3.5 lg:bg-bg" data-testid="public-notice">
          <p className="text-xs leading-[1.4] font-semibold">{tp.review.publicNotice}</p>
          <details className="text-xs leading-[1.4] text-muted">
            <summary className="cursor-pointer font-bold text-text">{tp.review.rulesTitle}</summary>
            <ul className="mt-1.5 list-disc pl-4">
              {tp.review.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <a href="/moderation" target="_blank" rel="noopener" className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              {tp.review.rulesLink}
            </a>
          </details>
        </div>

        {positionMissing && !point && (
          <p role="alert" className="flex items-start gap-2.5 rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
            <AlertIcon size={18} className="mt-px shrink-0" />
            {tp.review.errors.position_required}
          </p>
        )}

        {blocked && (
          <p role="alert" className="flex items-start gap-2.5 rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
            <AlertIcon size={18} className="mt-px shrink-0" />
            {tp.errors[blocked]}
          </p>
        )}

        <div className="sticky bottom-0 -mx-4 mt-auto bg-linear-to-t from-bg from-70% px-4 pt-4 pb-[calc(22px+env(safe-area-inset-bottom))] lg:-mx-6 lg:from-card lg:px-6">
          <StickButton type="submit" disabled={blocked !== null}>
            {tp.review.submit}
          </StickButton>
        </div>
      </form>

      <PickerPane
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        origin={position.source !== "manual" ? position.origin : null}
        value={point}
        fallbackCenter={props.fallbackCenter}
        radius={props.editRadius}
        onChange={props.onPositionChange}
      />
    </div>
  );
}
