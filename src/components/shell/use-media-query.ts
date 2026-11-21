"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Vrai si la requête média correspond (faux au rendu serveur). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tablette et web : colonne à gauche, carte à droite. */
export const WIDE_QUERY = "(min-width: 768px)";
