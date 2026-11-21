"use client";

import { useEffect } from "react";

/**
 * Le profil arrive en streaming : l'ancre (#album) n'existe pas encore quand le
 * navigateur lit l'URL. Une fois le contenu monté, on y descend.
 */
export function ScrollToHash({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);
  return null;
}
