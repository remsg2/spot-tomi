"use client";

import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/components/publish/icons";
import { photoFr as tp } from "@/i18n/photo.fr";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const SWIPE_CLOSE_PX = 110;

type View = { scale: number; x: number; y: number };
const RESET: View = { scale: 1, x: 0, y: 0 };

/** Décalage maximal : l'image agrandie ne laisse jamais de vide inutile sur un bord. */
function clampView(view: View, base: { w: number; h: number }, stage: { w: number; h: number }): View {
  const scale = Math.min(MAX_SCALE, Math.max(1, view.scale));
  const maxX = Math.max(0, (base.w * scale - stage.w) / 2);
  const maxY = Math.max(0, (base.h * scale - stage.h) / 2);
  return { scale, x: Math.min(maxX, Math.max(-maxX, view.x)), y: Math.min(maxY, Math.max(-maxY, view.y)) };
}

/** Zoom autour d'un point (relatif au centre de la scène) : ce point reste sous le doigt. */
function zoomAt(view: View, scale: number, px: number, py: number): View {
  const ratio = scale / view.scale;
  return { scale, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/**
 * Photo en entier, plein écran (dialog natif : Échap et focus gérés par le navigateur).
 * Double toucher ou double clic : zoom ; pincer ou molette : zoom progressif ; glisser :
 * déplacer l'image agrandie ; glisser vers le bas sans zoom : fermer.
 */
export function PhotoViewer({ src, alt, open, onClose }: { src: string; alt: string; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>(RESET);
  const [swipe, setSwipe] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: View;
    startX: number;
    startY: number;
    distance: number;
    midX: number;
    midY: number;
    moved: boolean;
  } | null>(null);
  const lastTap = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setView(RESET);
      setSwipe(0);
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function sizes() {
    const stage = stageRef.current?.getBoundingClientRect();
    const image = imageRef.current;
    const w = stage?.width ?? 0;
    const h = stage?.height ?? 0;
    // Taille de la photo affichée sans zoom (object-contain : ajustée à l'écran).
    const natW = image?.naturalWidth || w;
    const natH = image?.naturalHeight || h;
    const fit = natW > 0 && natH > 0 ? Math.min(w / natW, h / natH) : 1;
    return {
      stage: { w, h, left: stage?.left ?? 0, top: stage?.top ?? 0 },
      base: { w: natW * fit, h: natH * fit },
    };
  }

  /** Point du pointeur relatif au centre de la scène. */
  function local(clientX: number, clientY: number) {
    const { stage } = sizes();
    return { x: clientX - stage.left - stage.w / 2, y: clientY - stage.top - stage.h / 2 };
  }

  function apply(next: View) {
    const { stage, base } = sizes();
    setView(clampView(next, base, stage));
  }

  function toggleZoom(clientX: number, clientY: number) {
    const current = view;
    if (current.scale > 1.01) {
      setView(RESET);
      return;
    }
    const p = local(clientX, clientY);
    apply(zoomAt(current, DOUBLE_TAP_SCALE, p.x, p.y));
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    if ((event.target as Element).closest("button")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    const [a, b] = points;
    gesture.current = {
      start: view,
      startX: event.clientX,
      startY: event.clientY,
      distance: b ? Math.hypot(b.x - a.x, b.y - a.y) : 0,
      midX: b ? (a.x + b.x) / 2 : a.x,
      midY: b ? (a.y + b.y) / 2 : a.y,
      moved: points.length > 1,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const g = gesture.current;
    if (!g || !pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length >= 2 && g.distance > 0) {
      // Pincer : zoom autour du milieu des deux doigts.
      const [a, b] = points;
      const scale = g.start.scale * (Math.hypot(b.x - a.x, b.y - a.y) / g.distance);
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const startMid = local(g.midX, g.midY);
      const zoomed = zoomAt(g.start, Math.min(MAX_SCALE, Math.max(1, scale)), startMid.x, startMid.y);
      apply({ ...zoomed, x: zoomed.x + mid.x - startMid.x, y: zoomed.y + mid.y - startMid.y });
      return;
    }
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true;
    setDragging(true);
    if (g.start.scale > 1.01) apply({ ...g.start, x: g.start.x + dx, y: g.start.y + dy });
    else setSwipe(Math.max(0, dy));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const g = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) {
      // Un doigt reste : le geste repart de la position actuelle.
      const [rest] = [...pointers.current.values()];
      gesture.current = g && { ...g, start: view, startX: rest.x, startY: rest.y, distance: 0, moved: true };
      return;
    }
    gesture.current = null;
    setDragging(false);
    if (!g) return;
    if (swipe > SWIPE_CLOSE_PX) {
      onClose();
      return;
    }
    setSwipe(0);
    if (g.moved) return;
    const now = event.timeStamp;
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      toggleZoom(event.clientX, event.clientY);
    } else {
      lastTap.current = now;
    }
  }

  function onWheel(event: WheelEvent<HTMLDivElement>) {
    const p = local(event.clientX, event.clientY);
    const current = view;
    const scale = Math.min(MAX_SCALE, Math.max(1, current.scale * Math.exp(-event.deltaY * 0.0015)));
    apply(zoomAt(current, scale, p.x, p.y));
  }

  function zoomBy(factor: number) {
    const current = view;
    const scale = Math.min(MAX_SCALE, Math.max(1, current.scale * factor));
    apply(scale <= 1.01 ? RESET : zoomAt(current, scale, 0, 0));
  }

  const zoomed = view.scale > 1.01;
  const dialog = (
    <dialog
      ref={dialogRef}
      aria-label={alt}
      data-testid="photo-viewer"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Les gestes ne remontent pas jusqu'au tiroir de la fiche (arbre React).
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-black p-0 text-white backdrop:bg-black open:flex open:flex-col"
    >
      <div
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          gesture.current = null;
          setDragging(false);
          setSwipe(0);
        }}
        onWheel={onWheel}
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden select-none"
        style={{ opacity: swipe > 0 ? Math.max(0.35, 1 - swipe / 400) : 1 }}
      >
        {/* Photo publique en entier (object-contain), zoom par transformation CSS. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          draggable={false}
          className="h-full w-full object-contain"
          style={{
            transform: `translate3d(${view.x}px, ${view.y + swipe}px, 0) scale(${view.scale})`,
            transition: dragging ? "none" : "transform 160ms ease-out",
            cursor: zoomed ? "grab" : "zoom-in",
          }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-[calc(12px+env(safe-area-inset-top))_12px_12px]">
        <p className="pointer-events-auto mt-2.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold">{tp.viewer.hint}</p>
        <div className="pointer-events-auto flex gap-2">
          <button
            type="button"
            onClick={() => zoomBy(zoomed ? 0 : DOUBLE_TAP_SCALE)}
            aria-label={zoomed ? tp.viewer.zoomOut : tp.viewer.zoomIn}
            className="flex size-11 items-center justify-center rounded-full bg-black/55 text-xl font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span aria-hidden="true">{zoomed ? "−" : "+"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={tp.viewer.close}
            autoFocus
            className="flex size-11 items-center justify-center rounded-full bg-black/55 text-2xl leading-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <CloseIcon size={22} />
          </button>
        </div>
      </div>
    </dialog>
  );

  // Monté seulement à l'ouverture (jamais au rendu serveur) ; hors de l'arbre du tiroir.
  return createPortal(dialog, document.body);
}
