/**
 * Vibrations (retours haptiques) de la web app.
 *
 * - Android (Chrome, Firefox) : API Vibration (`navigator.vibrate`), motifs complets.
 * - iPhone : Safari n'a pas l'API Vibration. D'iOS 18 à 26.4, basculer par
 *   programme un interrupteur invisible (`<input type="checkbox" switch>`)
 *   produit un léger « tic » du système ; iOS 26.5 a fermé cette porte. Seul un
 *   toucher direct sur un interrupteur natif le produit encore : voir
 *   HapticTouch (src/components/ui/haptic-touch.tsx), posé sur les commandes
 *   principales. Un seul type de tic, répété pour une réussite ou une erreur.
 * - Ailleurs (ordinateur) : rien.
 *
 * Désactivables dans les réglages (préférence gardée sur l'appareil).
 */
import { isAppleMobile } from "./platform";

export type HapticKind = "selection" | "tap" | "success" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  selection: 8,
  tap: 14,
  success: [18, 70, 28, 70, 46],
  error: [45, 60, 45, 60, 45],
};
const IOS_TICKS: Record<HapticKind, number> = { selection: 1, tap: 1, success: 2, error: 3 };

export const HAPTICS_KEY = "spot-tomi:vibrations";

export function hapticsEnabled(): boolean {
  try {
    return window.localStorage.getItem(HAPTICS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean) {
  try {
    if (enabled) window.localStorage.removeItem(HAPTICS_KEY);
    else window.localStorage.setItem(HAPTICS_KEY, "off");
  } catch {
    // Stockage indisponible (navigation privée) : vibrations actives.
  }
}

/** Un « tic » iOS 18+ : interrupteur invisible basculé puis retiré. */
function iosTick() {
  const label = document.createElement("label");
  label.ariaHidden = "true";
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

/** Vibration courte (sélection, toucher) ou motif (réussite, erreur), si l'appareil le permet. */
export function haptic(kind: HapticKind = "tap") {
  if (typeof window === "undefined" || !hapticsEnabled()) return;
  if (typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(PATTERNS[kind]);
    } catch {
      // Refusé par le navigateur (pas d'activation utilisateur) : sans vibration.
    }
    return;
  }
  if (!isAppleMobile()) return;
  iosTick();
  for (let i = 1; i < IOS_TICKS[kind]; i += 1) window.setTimeout(iosTick, i * 120);
}

/** Vibrations possibles sur cet appareil (réglage affiché seulement dans ce cas). */
export function hapticsSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof navigator.vibrate === "function" || isAppleMobile();
}
