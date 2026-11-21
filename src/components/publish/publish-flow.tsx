"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishErrorKey } from "@/i18n/publish.fr";
import { PhotoError, preparePhoto, reencodeToWebp, type PreparedPhoto } from "@/lib/publish/browser-image";
import {
  DEFAULT_COMMENT_MAX,
  DEFAULT_EDIT_RADIUS_M,
  photoPathFor,
  placeNameSchema,
  THUMB_SIDE,
  thumbPathFor,
  type DateSource,
  type GpsSource,
  type PublishResult,
} from "@/lib/publish/contract";
import { haptic } from "@/lib/haptics";
import { reportClientError } from "@/lib/errors/report";
import { isFreshPhoto, readDevicePosition, type PhotoOrigin } from "@/lib/publish/device-position";
import type { LatLng } from "@/lib/publish/geo";
import {
  checkPasted,
  defaultEdition,
  defaultPastedOn,
  pastedTakenAt,
  type EditionOption,
} from "@/lib/publish/pasted";
import { photoHash } from "@/lib/publish/photo-hash";
import { PublishError, type PublishServices } from "@/lib/publish/services";
import { needsReview } from "@/lib/publish/status";
import { DoneStep } from "./done-step";
import type { EstimateState } from "./estimate-panel";
import { PhotoStep, type PhotoStepError, type PhotoStepStatus } from "./photo-step";
import { PublishingStep, type PublishPhase } from "./publishing-step";
import { ReviewStep, type NameError, type PositionState } from "./review-step";

type Step =
  | { kind: "photo"; status: PhotoStepStatus; error: PhotoStepError | null }
  | { kind: "review" }
  | { kind: "publishing"; phase: PublishPhase; error: PublishErrorKey | null; message?: string }
  | { kind: "done"; result: PublishResult };

export type PublishFlowProps = {
  userId: string;
  services: PublishServices;
  /** Déplacement maximal d'une position GPS (scoring_rules.edit_radius_m). */
  editRadius?: number;
  /** Centre de la carte sans GPS (sinon le monde entier). */
  fallbackCenter?: LatLng | null;
  /** Éditions que le membre peut choisir (actives, jusqu'à l'édition en cours). */
  editions: EditionOption[];
  /** Longueur maximale du commentaire (scoring_rules.comment_max_length). */
  commentMax?: number;
  /** Aujourd'hui (injecté par les tests). */
  now?: () => Date;
};

const BLOCKING_ESTIMATE_ERRORS: PublishErrorKey[] = ["suspended", "missing_profile", "unauthorized"];
const PHOTO_ERRORS: PhotoStepError[] = ["too_big", "unsupported", "empty", "decode"];
const NO_POSITION: PositionState = { source: "manual", origin: null, point: null, altitude: null };

function errorCode(error: unknown): PublishErrorKey {
  if (error instanceof PublishError) return error.code;
  if (error instanceof PhotoError) return "encode_failed";
  return "unknown";
}

/**
 * Parcours « Nouveau sticker » (spécifications 2.2, maquettes Ajout et Bravo) :
 * 1. photo, 2. vérification, 3. publication, puis « Sticker collé ».
 * Les accès serveur passent par `services` (Supabase, ou doublures en test).
 */
export function PublishFlow({
  userId,
  services,
  editRadius = DEFAULT_EDIT_RADIUS_M,
  fallbackCenter = null,
  editions,
  commentMax = DEFAULT_COMMENT_MAX,
  now = () => new Date(),
}: PublishFlowProps) {
  const [step, setStep] = useState<Step>({ kind: "photo", status: "idle", error: null });
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [position, setPosition] = useState<PositionState>(NO_POSITION);
  /** Photo prise à l'instant : la date et la position du téléphone valent celles de la photo. */
  const [fresh, setFresh] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<NameError | null>(null);
  const [comment, setComment] = useState("");
  /** Date du collage (jour local), préremplie par la photo ou le jour même. */
  const [pastedOn, setPastedOn] = useState("");
  const [edition, setEdition] = useState<number | null>(null);
  const [editionChosen, setEditionChosen] = useState(false);
  const [showDateError, setShowDateError] = useState(false);
  const [estimate, setEstimate] = useState<EstimateState>({ kind: "waiting" });
  const estimateSeq = useRef(0);
  const estimateTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Photo déjà réencodée puis envoyée : une nouvelle tentative ne refait que l'étape qui a échoué.
  const prepared = useRef<{ blob: Blob | null; path: string | null; thumbPath: string | null; hash: string | null | undefined }>({
    blob: null,
    path: null,
    thumbPath: null,
    hash: undefined,
  });
  const previewUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      clearTimeout(estimateTimer.current);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const photoDay = photo ? defaultPastedOn(photo.meta.takenAtLocal, now()) : null;
  const dateEdited = photo !== null && pastedOn !== photoDay;
  const dateSource: DateSource = dateEdited
    ? "manual"
    : photo?.meta.takenAt
      ? "exif"
      : fresh
        ? "device"
        : "upload";
  const gpsSource: GpsSource = position.source;
  const review = needsReview(gpsSource);
  const dateError = photo ? checkPasted(pastedOn, edition, now()) : null;
  const commentTooLong = comment.trim().length > commentMax;
  const blocked: PublishErrorKey | null =
    estimate.kind === "ready" && estimate.data.blocked
      ? estimate.data.blocked
      : estimate.kind === "error" && BLOCKING_ESTIMATE_ERRORS.includes(estimate.code)
        ? estimate.code
        : null;

  function requestEstimate(
    point: LatLng,
    gps: GpsSource,
    altitude: number | null,
    takenAt: string | null,
    date: DateSource,
    year: number | null,
  ) {
    const seq = ++estimateSeq.current;
    clearTimeout(estimateTimer.current);
    setEstimate((previous) => ({
      kind: "loading",
      previous: previous.kind === "ready" ? previous.data : previous.kind === "loading" ? previous.previous : null,
    }));
    estimateTimer.current = setTimeout(async () => {
      try {
        const data = await services.estimate({
          lat: point.lat,
          lng: point.lng,
          altitude: gps === "manual" ? null : altitude,
          takenAt,
          gpsSource: gps,
          dateSource: date,
          year,
        });
        if (seq === estimateSeq.current) setEstimate({ kind: "ready", data });
      } catch (error) {
        if (seq === estimateSeq.current) setEstimate({ kind: "error", code: errorCode(error) });
      }
    }, 300);
  }

  async function handleFile(file: File, origin: PhotoOrigin) {
    setStep({ kind: "photo", status: "reading", error: null });
    try {
      const next = await preparePhoto(file, (status) => setStep({ kind: "photo", status, error: null }));
      const isFresh = isFreshPhoto(origin, next.meta.takenAt);
      let nextPosition: PositionState = next.meta.gps
        ? { source: "exif", origin: next.meta.gps, point: next.meta.gps, altitude: next.meta.altitude }
        : NO_POSITION;
      // Sans GPS dans la photo (Safari le retire sur iPhone) : position du téléphone si elle vient d'être prise.
      if (!next.meta.gps && isFresh) {
        setStep({ kind: "photo", status: "locating", error: null });
        const device = await readDevicePosition();
        if (device) nextPosition = { source: "device", origin: device.point, point: device.point, altitude: device.altitude };
      }
      const nextDateSource: DateSource = next.meta.takenAt ? "exif" : isFresh ? "device" : "upload";
      const nextPastedOn = defaultPastedOn(next.meta.takenAtLocal, now());
      const nextEdition = editionChosen && edition !== null ? edition : defaultEdition(editions, nextPastedOn);

      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = next.previewUrl;
      prepared.current = { blob: null, path: null, thumbPath: null, hash: undefined };
      setPhoto(next);
      setFresh(isFresh);
      setPastedOn(nextPastedOn);
      setEdition(nextEdition);
      setShowDateError(false);
      setPosition(nextPosition);
      estimateSeq.current += 1;
      clearTimeout(estimateTimer.current);
      setEstimate({ kind: "waiting" });
      if (nextPosition.point) {
        requestEstimate(
          nextPosition.point,
          nextPosition.source,
          nextPosition.altitude,
          next.meta.takenAt,
          nextDateSource,
          nextEdition,
        );
      }
      setStep({ kind: "review" });
    } catch (error) {
      const reason = error instanceof PhotoError ? error.reason : "decode";
      setStep({
        kind: "photo",
        status: "idle",
        error: (PHOTO_ERRORS as string[]).includes(reason) ? (reason as PhotoStepError) : "decode",
      });
    }
  }

  function handlePositionChange(point: LatLng) {
    if (!photo) return;
    setPosition((current) => ({ ...current, point }));
    requestEstimate(point, position.source, position.altitude, photo.meta.takenAt, dateSource, edition);
  }

  function handlePastedChange(value: string) {
    setPastedOn(value);
    // Tant que le membre n'a pas choisi d'édition, elle suit la date.
    if (!editionChosen && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const next = defaultEdition(editions, value);
      if (next !== edition) {
        setEdition(next);
        if (photo && position.point) {
          requestEstimate(position.point, position.source, position.altitude, photo.meta.takenAt, "manual", next);
        }
      }
    }
  }

  function handleEditionChange(year: number) {
    setEdition(year);
    setEditionChosen(true);
    if (photo && position.point) {
      requestEstimate(position.point, position.source, position.altitude, photo.meta.takenAt, dateSource, year);
    }
  }

  async function publish(cleanName: string) {
    if (!photo || !position.point) return;
    const point = position.point;
    let phase: PublishPhase = "encode";
    try {
      if (!prepared.current.path) {
        setStep({ kind: "publishing", phase: "encode", error: null });
        const blob = prepared.current.blob ?? (await reencodeToWebp(photo.decodable));
        prepared.current.blob = blob;
        // Empreinte (photos très proches) : facultative, jamais bloquante.
        if (prepared.current.hash === undefined) prepared.current.hash = await photoHash(photo.decodable);

        phase = "upload";
        setStep({ kind: "publishing", phase, error: null });
        const path = photoPathFor(userId, crypto.randomUUID());
        await services.upload(path, blob);
        // Miniature (listes, fil photo) : facultative, une erreur n'empêche pas la publication.
        let thumbPath: string | null = null;
        try {
          const thumb = await reencodeToWebp(photo.decodable, { maxSide: THUMB_SIDE, quality: 0.8 });
          await services.upload(thumbPathFor(path), thumb);
          thumbPath = thumbPathFor(path);
        } catch (error) {
          reportClientError("upload", error, "/spots/new (miniature)");
        }
        prepared.current.path = path;
        prepared.current.thumbPath = thumbPath;
      }

      phase = "score";
      setStep({ kind: "publishing", phase, error: null });
      const result = await services.publish({
        photoPath: prepared.current.path,
        lat: point.lat,
        lng: point.lng,
        altitude: gpsSource === "manual" ? null : position.altitude,
        takenAt: dateSource === "manual" ? pastedTakenAt(pastedOn, photo.meta.takenAt, photoDay) : photo.meta.takenAt,
        gpsSource,
        dateSource,
        name: cleanName,
        year: edition,
        comment: comment.trim() || null,
        thumbPath: prepared.current.thumbPath,
        photoHash: prepared.current.hash ?? null,
      });
      haptic("success");
      setStep({ kind: "done", result });
    } catch (error) {
      haptic("error");
      if (phase === "upload" || (error instanceof PublishError && error.code === "server_error")) {
        reportClientError(phase === "upload" ? "upload" : "client", error, `/spots/new (${phase})`);
      }
      // Refus du serveur : la photo envoyée a été supprimée, une nouvelle tentative la renvoie.
      if (phase === "score") {
        prepared.current.path = null;
        prepared.current.thumbPath = null;
      }
      setStep({
        kind: "publishing",
        phase,
        error: errorCode(error),
        message: error instanceof PublishError ? error.serverMessage : undefined,
      });
    }
  }

  function handleSubmit() {
    const parsed = placeNameSchema.safeParse(name);
    if (!parsed.success) {
      const code = parsed.error.issues[0]?.message;
      setNameError(code === "name_too_long" ? "name_too_long" : "name_required");
      return;
    }
    setNameError(null);
    if (dateError) {
      setShowDateError(true);
      return;
    }
    if (commentTooLong || !position.point || blocked) return;
    haptic("tap");
    void publish(parsed.data);
  }

  function restart() {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    prepared.current = { blob: null, path: null, thumbPath: null, hash: undefined };
    estimateSeq.current += 1;
    setPhoto(null);
    setFresh(false);
    setPosition(NO_POSITION);
    setName("");
    setNameError(null);
    setComment("");
    setEditionChosen(false);
    setShowDateError(false);
    setEstimate({ kind: "waiting" });
    setStep({ kind: "photo", status: "idle", error: null });
  }

  switch (step.kind) {
    case "photo":
      return <PhotoStep status={step.status} error={step.error} onFile={handleFile} />;
    case "review":
      if (!photo) return null;
      return (
        <ReviewStep
          photo={photo}
          position={position}
          onPositionChange={handlePositionChange}
          editRadius={editRadius}
          fallbackCenter={fallbackCenter}
          dateFromPhoto={Boolean(photo.meta.takenAtLocal)}
          pastedOn={pastedOn}
          onPastedChange={handlePastedChange}
          dateError={showDateError || dateError === "future" ? dateError : null}
          today={defaultPastedOn(null, now())}
          editions={editions}
          edition={edition}
          onEditionChange={handleEditionChange}
          needsReview={review}
          comment={comment}
          commentMax={commentMax}
          onCommentChange={setComment}
          name={name}
          onNameChange={(value) => {
            setName(value);
            if (nameError) setNameError(null);
          }}
          nameError={nameError}
          estimate={estimate}
          blocked={blocked}
          onChangePhoto={() => setStep({ kind: "photo", status: "idle", error: null })}
          onSubmit={handleSubmit}
        />
      );
    case "publishing":
      return (
        <PublishingStep
          previewUrl={photo?.previewUrl ?? ""}
          phase={step.phase}
          error={step.error}
          serverMessage={step.message}
          onRetry={() => handleSubmit()}
          onBack={() => setStep({ kind: "review" })}
        />
      );
    case "done":
      return <DoneStep result={step.result} onAnother={restart} />;
  }
}
