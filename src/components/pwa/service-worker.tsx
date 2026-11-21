"use client";

import { SerwistProvider } from "@serwist/next/react";

/**
 * Enregistre le service worker Serwist (public/sw.js, généré par `serwist build`
 * après `next build`). Désactivé en développement : le fichier n'y existe pas.
 * Pas de rechargement automatique au retour du réseau : il effacerait un
 * formulaire en cours (ajout d'un sticker).
 */
export function ServiceWorker() {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      reloadOnOnline={false}
      options={{ scope: "/", type: "classic", updateViaCache: "none" }}
    />
  );
}
