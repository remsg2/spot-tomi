"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export const THEMES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEMES)[number];

/**
 * Thème clair / sombre / système, sans flash au chargement : next-themes
 * pose `data-theme` sur <html> par un script exécuté avant le premier rendu.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="spot-tomi-theme"
    >
      {children}
    </NextThemesProvider>
  );
}
