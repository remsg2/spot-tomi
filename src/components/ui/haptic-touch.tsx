"use client";

import { useSyncExternalStore } from "react";
import { hapticsEnabled } from "@/lib/haptics";
import { isAppleMobile } from "@/lib/platform";

const noSubscription = () => () => {};

/**
 * Retour haptique sur iPhone : interrupteur natif invisible posé sur une commande.
 *
 * Safari n'a pas l'API Vibration, et depuis iOS 26.5 une page ne peut plus
 * déclencher le tic du système par programme (src/lib/haptics.ts). Un toucher
 * direct sur un interrupteur natif (`<input type="checkbox" switch>`) le produit
 * toujours : l'interrupteur, transparent, recouvre la commande et l'active comme
 * un clic. Le clavier et les lecteurs d'écran utilisent la commande d'origine
 * (l'interrupteur leur est caché). Hors iPhone, ou vibrations désactivées dans
 * les réglages : rien n'est ajouté.
 *
 * Le parent doit être positionné (relative) ; `onActivate` reçoit l'action
 * seule, sans autre vibration.
 */
export function HapticTouch({ onActivate, disabled }: { onActivate: () => void; disabled?: boolean }) {
  const active = useSyncExternalStore(noSubscription, () => isAppleMobile() && hapticsEnabled(), () => false);
  if (!active) return null;
  return (
    <input
      type="checkbox"
      ref={(element) => element?.setAttribute("switch", "")}
      aria-hidden="true"
      tabIndex={-1}
      disabled={disabled}
      data-haptic-touch=""
      onChange={() => onActivate()}
      className="absolute inset-0 z-10 m-0 size-full cursor-pointer appearance-auto opacity-0 disabled:pointer-events-none"
    />
  );
}
