// @ts-check
/**
 * Service worker de la PWA (Serwist en mode « configurateur », compatible
 * Turbopack) : `serwist build` compile src/sw/sw.ts vers public/sw.js après
 * `next build`, avec la liste de précache (fichiers _next/static et public/).
 */
import { randomUUID } from "node:crypto";
import { serwist } from "@serwist/next/config";

// Même identifiant que la build Next (next.config.ts) : la page hors ligne est
// rechargée à chaque déploiement.
const revision = process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? randomUUID();

export default serwist({
  swSrc: "src/sw/sw.ts",
  swDest: "public/sw.js",
  // Les pages pré-rendues ne sont pas précachées : avec Cache Components, ce ne
  // sont que des coquilles statiques, et la session doit venir du réseau.
  precachePrerendered: false,
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  // Les icônes ne servent qu'au système (installation) : inutile de les précacher.
  globIgnores: ["public/icons/**", "public/sw.js*"],
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
});
