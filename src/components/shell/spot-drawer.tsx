"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useMapContext } from "@/components/map/map-provider";
import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { haptic } from "@/lib/haptics";
import { canGoBackInApp } from "@/lib/navigation/back";

/** Part de la hauteur du tiroir cachée sous l'écran à mi-hauteur (55 % visibles). */
export const HALF_OFFSET = 0.45;
/** Au-delà de ce déplacement (px), le geste est un glissement et non un toucher. */
const DRAG_THRESHOLD = 6;
/** Vitesse (px/ms) d'un geste rapide vers le haut ou le bas. */
const FLICK = 0.8;
const CLOSE_DELAY_MS = 220;

type Snap = "half" | "full";
type Gesture = {
  id: number;
  startY: number;
  startOffset: number;
  lastY: number;
  lastT: number;
  velocity: number;
  moved: boolean;
  grip: boolean;
  onControl: boolean;
};

/** Ferme la fiche : retour à la page précédente de l'app (la carte), sinon la carte. */
export function useCloseSpot() {
  const router = useRouter();
  return () => {
    if (canGoBackInApp()) router.back();
    else router.replace("/");
  };
}

/**
 * Colonne de la fiche lieu. Sous 768 px, c'est un tiroir posé sur la carte :
 * il s'ouvre à mi-hauteur, se tire vers le haut (plein écran) ou vers le bas
 * (fermeture), Échap le ferme. À partir de 768 px, c'est la colonne de gauche.
 *
 * À mi-hauteur, tout le tiroir se tire (son contenu ne défile pas) ; en plein
 * écran, le contenu défile et seuls la poignée et la photo ([data-sheet-grip])
 * ramènent le tiroir vers le bas.
 */
export function SpotDrawer({ wide, children }: { wide: boolean; children: ReactNode }) {
  const { setBottomInset } = useMapContext();
  const close = useCloseSpot();
  const ref = useRef<HTMLElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const [snap, setSnap] = useState<Snap>("half");
  /** Décalage imposé en px pendant un glissement ou la fermeture (sinon celui du cran). */
  const [offset, setOffset] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // La carte garde le sticker visible au-dessus du tiroir à mi-hauteur.
  useEffect(() => {
    if (wide) return;
    const element = ref.current;
    if (!element) return;
    const update = () => setBottomInset(Math.round(element.offsetHeight * (1 - HALF_OFFSET)));
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      setBottomInset(0);
    };
  }, [wide, setBottomInset]);

  useEffect(() => {
    if (wide) return;
    const onKey = (event: KeyboardEvent) => {
      // Échap ferme d'abord la fenêtre ouverte par-dessus (visionneuse photo), pas la fiche.
      if (event.key !== "Escape" || event.defaultPrevented || document.querySelector("dialog[open]")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function height() {
    return ref.current?.offsetHeight ?? window.innerHeight;
  }

  function snapOffset(value: Snap) {
    return value === "full" ? 0 : height() * HALF_OFFSET;
  }

  function animateClose() {
    haptic("tap");
    setDragging(false);
    setOffset(height());
    window.setTimeout(close, CLOSE_DELAY_MS);
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (wide || event.button !== 0) return;
    const target = event.target as Element;
    const grip = target.closest("[data-sheet-grip]") !== null;
    if (snap === "full" && !grip) return;
    const onControl = target.closest("a, button, input, textarea, select") !== null;
    gesture.current = {
      id: event.pointerId,
      startY: event.clientY,
      startOffset: snapOffset(snap),
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
      moved: false,
      grip,
      onControl,
    };
    // Le geste suit le pointeur même hors du tiroir (vers le haut depuis la poignée).
    // Pas sur un bouton ou un lien : leur clic doit rester sur eux.
    if (!onControl) ref.current?.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.id) return;
    const dy = event.clientY - g.startY;
    if (!g.moved) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;
      g.moved = true;
      setDragging(true);
      ref.current?.setPointerCapture?.(event.pointerId);
    }
    const dt = event.timeStamp - g.lastT;
    if (dt > 0) g.velocity = (event.clientY - g.lastY) / dt;
    g.lastY = event.clientY;
    g.lastT = event.timeStamp;
    setOffset(Math.min(height(), Math.max(0, g.startOffset + dy)));
  }

  function onPointerUp(event: PointerEvent<HTMLElement>) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.id) return;
    gesture.current = null;
    if (!g.moved) {
      // Toucher la poignée (hors bouton) : bascule mi-hauteur / plein écran.
      if (g.grip && !g.onControl) {
        haptic("selection");
        setSnap((current) => (current === "half" ? "full" : "half"));
      }
      return;
    }
    suppressClick.current = true;
    setDragging(false);
    const h = height();
    const half = h * HALF_OFFSET;
    const y = Math.min(h, Math.max(0, g.startOffset + (g.lastY - g.startY)));
    let next: Snap | "close";
    if (g.velocity > FLICK) next = snap === "full" && y < half ? "half" : "close";
    else if (g.velocity < -FLICK) next = "full";
    else if (y > half + (h - half) * 0.35) next = "close";
    else next = y < half / 2 ? "full" : "half";

    if (next === "close") {
      animateClose();
      return;
    }
    setOffset(null);
    if (next !== snap) haptic("selection");
    setSnap(next);
  }

  function onPointerCancel() {
    gesture.current = null;
    setDragging(false);
    setOffset(null);
  }

  const style = { "--sheet-y": offset === null ? (snap === "full" ? "0px" : `${HALF_OFFSET * 100}%`) : `${offset}px` } as CSSProperties;

  return (
    <main
      ref={ref}
      id="contenu"
      data-testid="shell-column"
      data-sheet={snap}
      data-dragging={dragging || undefined}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // Pas de glisser-déposer natif (texte sélectionné, image) : il annulerait le geste.
      onDragStart={(event) => {
        if (!wide) event.preventDefault();
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className={cn(
        "spot-drawer flex min-h-0 flex-col bg-card",
        dragging && "select-none",
        // Mobile : tiroir posé sur la carte, sous la marge de l'en-tête.
        // Le cadre ne défile jamais (touch-none) : seul le contenu défile, en plein écran.
        "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:h-[calc(100dvh-44px-env(safe-area-inset-top))] max-md:touch-none max-md:overflow-hidden max-md:rounded-t-[26px] max-md:shadow-[0_-10px_30px_rgb(0_0_0/0.25)]",
        // Tablette et web : colonne de gauche.
        "md:w-[380px] md:flex-none md:border-r md:border-line lg:w-[440px]",
      )}
    >
      <div
        data-sheet-grip=""
        role="button"
        tabIndex={wide ? -1 : 0}
        aria-label={snap === "half" ? tm.drawer.expand : tm.drawer.collapse}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSnap((current) => (current === "half" ? "full" : "half"));
          }
        }}
        className="absolute inset-x-0 top-0 z-20 flex h-8 touch-none justify-center pt-2 select-none outline-none focus-visible:[&>span]:outline-3 focus-visible:[&>span]:outline-white md:hidden"
      >
        <span aria-hidden="true" className="h-1.5 w-11 rounded-full bg-white/90 shadow-[0_1px_4px_rgb(0_0_0/0.35)]" />
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
          snap === "half" ? "max-md:overflow-hidden" : "max-md:touch-pan-y",
        )}
      >
        {children}
      </div>
    </main>
  );
}
