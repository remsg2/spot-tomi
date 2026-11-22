"use client";

import { useRef, useState } from "react";
import { ExpandIcon } from "@/components/publish/icons";
import { photoFr as tp } from "@/i18n/photo.fr";
import { cn } from "@/lib/cn";
import { focusPosition, type PhotoFocus } from "@/lib/photo/focus";
import { PhotoViewer } from "./photo-viewer";

/**
 * Photo recadrée (object-cover) centrée sur le sticker quand son repère est connu, avec
 * un bouton pour la voir en entier (visionneuse plein écran). En web, cliquer la photo
 * l'ouvre aussi ; sur mobile, la photo reste la poignée du tiroir de la fiche.
 */
export function ZoomablePhoto({
  src,
  alt,
  focus,
  width,
  height,
  priority = false,
  buttonClassName,
}: {
  src: string;
  alt: string;
  focus: PhotoFocus | null;
  width: number;
  height: number;
  priority?: boolean;
  /** Position du bouton « Voir la photo en entier ». */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    // La visionneuse est démontée : le focus revient au bouton qui l'a ouverte.
    requestAnimationFrame(() => buttonRef.current?.focus());
  }
  return (
    <>
      {/* Photo publique du bucket spot-photos (WebP sans EXIF), servie par Supabase. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        fetchPriority={priority ? "high" : undefined}
        className="h-full w-full object-cover"
        style={{ objectPosition: focusPosition(focus) }}
        data-focus={focus ? `${focus.x},${focus.y}` : undefined}
      />
      {/* Web : toute la photo ouvre la visionneuse (doublon du bouton, caché aux lecteurs d'écran). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => setOpen(true)}
        className="absolute inset-0 hidden cursor-zoom-in md:block"
      />
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={tp.viewer.open}
        className={cn(
          "absolute flex size-11 items-center justify-center rounded-full bg-black/55 text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white",
          buttonClassName ?? "right-3 bottom-3",
        )}
      >
        <ExpandIcon size={18} />
      </button>
      {open && <PhotoViewer src={src} alt={alt} open onClose={close} />}
    </>
  );
}
