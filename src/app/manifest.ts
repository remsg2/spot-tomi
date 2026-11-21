import type { MetadataRoute } from "next";
import { t } from "@/i18n/fr";

/** Manifeste de la PWA (installable sur iOS et Android), servi en /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: t.app.name,
    short_name: t.app.name,
    description: t.app.description,
    lang: "fr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F3F1EB",
    theme_color: "#F3F1EB",
    categories: ["travel", "games", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
