"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * Applique le thème enregistré dans le profil sur un nouvel appareil,
 * tant qu'aucun choix local n'a été fait.
 */
export function ProfileThemeSync({ theme }: { theme: "system" | "light" | "dark" }) {
  const { setTheme } = useTheme();
  useEffect(() => {
    try {
      if (!localStorage.getItem("spot-tomi-theme")) setTheme(theme);
    } catch {
      // Stockage local indisponible : on garde le thème du système.
    }
  }, [theme, setTheme]);
  return null;
}
