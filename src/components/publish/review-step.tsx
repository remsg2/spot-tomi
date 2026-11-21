"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { formatCoordinates, formatTakenAt, tp, type PublishErrorKey } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import type { PreparedPhoto } from "@/lib/publish/browser-image";
import { PLACE_NAME_MAX, type DateSource } from "@/lib/publish/contract";
import { isAppleMobile } from "@/lib/publish/device-position";
import { distanceMeters, type LatLng } from "@/lib/publish/geo";
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
  dateSource: DateSource;
  year: number;
  pending: boolean;
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
  const { photo, position, estimate, blocked, pending } = props;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [positionMissing, setPositionMissing] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameId = useId();
  const nameErrorId = useId();
  const country = estimate.kind === "ready" ? estimate.data.countryNameFr : null;
  const point = position.point;
  const moved = position.origin && point ? Math.round(distanceMeters(position.origin, point)) : 0;
  const appleMobile = useSyncExternalStore(noSubscription, isAppleMobile, () => false);
  const dateVerified = props.dateSource !== "upload";

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

        <div className="relative h-[200px] shrink-0 overflow-hidden rounded-[20px] bg-soft">
          {/* Aperçu local (blob:), jamais envoyé tel quel : next/image n'apporte rien ici. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.previewUrl} alt={tp.review.photoAlt} className="size-full object-cover" />
          <button
            type="button"
            onClick={props.onChangePhoto}
            className="absolute bottom-3 left-3 h-[34px] rounded-full bg-black/60 px-3 text-xs font-semibold text-white after:absolute after:-inset-[5px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {tp.review.changePhoto}
          </button>
        </div>

        <div className="flex flex-col rounded-[20px] border border-line bg-card px-3.5 py-1.5 lg:bg-bg">
          <ul aria-label={tp.review.checksLabel}>
            {positionRow}
            <CheckRow
              tone={dateVerified ? "ok" : "todo"}
              icon={dateVerified ? <CheckIcon size={16} /> : <AlertIcon size={15} />}
              label={tp.review.dateLabel}
              value={
                props.dateSource === "exif" && photo.meta.takenAtLocal
                  ? formatTakenAt(photo.meta.takenAtLocal)
                  : props.dateSource === "device"
                    ? tp.review.dateDevice
                    : tp.review.dateMissing
              }
            />
            <CheckRow
              tone="ok"
              icon={<CheckIcon size={16} />}
              label={tp.review.yearLabel}
              value={dateVerified ? tp.review.yearFromDate(props.year) : tp.review.yearFromUpload(props.year)}
            />
          </ul>
          <div className="flex items-center gap-3 py-2.5">
            <span aria-hidden="true" className="flex size-[26px] shrink-0 items-center justify-center rounded-[8px] bg-soft text-text">
              <LockIcon size={15} />
            </span>
            <span className="text-xs leading-[1.35] text-muted">{tp.review.privacy}</span>
          </div>
        </div>

        {pending && <p className="text-xs leading-[1.4] text-muted">{tp.review.pendingNotice}</p>}
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

        <EstimatePanel state={estimate} pending={pending} />

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
