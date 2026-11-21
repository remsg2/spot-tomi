"use client";

import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { HapticTouch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ArrowRightIcon } from "./icons";

/**
 * Bouton « Coller le sticker » de la maquette : fond couleur de l'année,
 * grand triangle noir à droite et flèche couleur de l'année.
 */
export function StickButton({
  children,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  const button = useRef<HTMLButtonElement>(null);
  return (
    <span className={cn("relative flex w-full", className)}>
      <button
        ref={button}
        type={type}
        className="relative flex h-[58px] w-full items-center overflow-hidden rounded-[18px] bg-year px-5 text-left text-on-year shadow-[0_8px_20px_rgb(0_0_0/0.2)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
        {...props}
      >
        <span className="relative font-display text-lg">{children}</span>
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-band [clip-path:polygon(62%_100%,100%_0,100%_100%)]"
        />
        <ArrowRightIcon size={22} className="absolute right-[18px] text-year" />
      </button>
      {/* iPhone : tic du système au toucher (src/components/ui/haptic-touch.tsx). */}
      <HapticTouch disabled={props.disabled} onActivate={() => button.current?.click()} />
    </span>
  );
}
