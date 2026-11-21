/// <reference lib="webworker" />
/**
 * Service worker de la PWA (Serwist), compilé par `serwist build` vers public/sw.js.
 *
 * Mise en cache hors ligne « raisonnable », sans casser l'authentification :
 * - précache : fichiers statiques de Next (_next/static), public/ et la page /~offline ;
 * - pages publiques (carte, fiches, classement) : réseau d'abord, cache en secours ;
 * - pages privées et authentification (/auth, /login, /me, /admin, /api, /spots/new) :
 *   réseau uniquement, jamais en cache ; page hors ligne en secours ;
 * - API Supabase (données, session, fonctions) : jamais interceptée, sauf les photos
 *   publiques des stickers (cache) ;
 * - tuiles, glyphes et sprites OpenFreeMap : cache, rafraîchi en arrière-plan ;
 * - à la connexion ou à la déconnexion, les pages en cache (qui peuvent montrer le
 *   score de l'ancien compte) sont effacées.
 */
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const PAGE_CACHES = ["pages", "pages-rsc"];
const PRIVATE_PATHS = /^\/(auth|login|welcome|me|admin|api|spots\/new)(\/|$)/;
const DAY = 24 * 60 * 60;

const isRsc = (request: Request) => request.headers.get("RSC") === "1";

async function purgePageCaches() {
  await Promise.all(PAGE_CACHES.map((name) => caches.delete(name)));
}

const runtimeCaching: RuntimeCaching[] = [
  // Pages privées et authentification : toujours le réseau.
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && PRIVATE_PATHS.test(url.pathname),
    handler: new NetworkOnly(),
  },
  // Fichiers de build, immuables (nom avec empreinte).
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true })],
    }),
  },
  // Images optimisées par Next.
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/_next/image",
    handler: new StaleWhileRevalidate({
      cacheName: "next-image",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true })],
    }),
  },
  // Fichiers publics (icônes, Tomi, frontières des pays, worker de la carte).
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && /\.(?:png|jpe?g|webp|svg|ico|json|mjs|webmanifest)$/i.test(url.pathname),
    handler: new StaleWhileRevalidate({
      cacheName: "static-assets",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true })],
    }),
  },
  // Photos publiques des stickers (Supabase Storage, bucket public spot-photos).
  {
    matcher: ({ url, request }) =>
      request.destination === "image" && url.pathname.includes("/storage/v1/object/public/"),
    handler: new CacheFirst({
      cacheName: "spot-photos",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true }),
      ],
    }),
  },
  // Fond de carte OpenFreeMap : style, tuiles, glyphes, sprites.
  {
    matcher: ({ url }) => url.origin === "https://tiles.openfreemap.org",
    handler: new StaleWhileRevalidate({
      cacheName: "map-tiles",
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 1500, maxAgeSeconds: 14 * DAY, purgeOnQuotaError: true }),
      ],
    }),
  },
  // Navigation côté client (charges RSC) des pages publiques.
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && isRsc(request),
    handler: new NetworkFirst({
      cacheName: "pages-rsc",
      plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: DAY })],
    }),
  },
  // Pages publiques : réseau d'abord, la dernière version en cache sans réseau.
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === "navigate",
    handler: new NetworkFirst({
      cacheName: "pages",
      plugins: [
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 7 * DAY }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

// Connexion, déconnexion : on oublie les pages de l'ancien compte (sans toucher à la requête).
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && /^\/(auth|login)(\/|$)/.test(url.pathname)) {
    event.waitUntil(purgePageCaches());
  }
});

serwist.addEventListeners();
