"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { MapMarker } from "@/components/ui";
import { tp } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import { circlePolygon, clampToRadius, distanceMeters, normalizeLng, type LatLng } from "@/lib/publish/geo";
import { LocateIcon, UndoIcon } from "./icons";
import { fallbackStyle, loadMapStyle } from "./map-style";

export type PositionPickerProps = {
  /** Position GPS de la photo : le repère reste à `radius` mètres au plus. Null : placement libre. */
  origin: LatLng | null;
  /** Position actuelle du sticker, s'il y en a une. */
  value: LatLng | null;
  /** Centre de départ quand il n'y a aucune position, sinon le monde entier. */
  fallbackCenter: LatLng | null;
  radius: number;
  /** Centre et zoom de la carte après chaque déplacement (centre déjà limité au rayon). */
  onCenterChange: (point: LatLng, zoom: number) => void;
  className?: string;
};

type Theme = "light" | "dark";

const RADIUS_SOURCE = "spot-tomi-rayon";
const ORIGIN_SOURCE = "spot-tomi-origine";

function yearColor(): string {
  if (typeof document === "undefined") return "#9A9A94";
  return getComputedStyle(document.documentElement).getPropertyValue("--year").trim() || "#9A9A94";
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Cercle des 200 m et position d'origine, à redessiner après chaque changement de style. */
function drawOverlay(map: MapLibreMap, origin: LatLng | null, radius: number, theme: Theme) {
  for (const id of ["spot-tomi-rayon-fond", "spot-tomi-rayon-bord", "spot-tomi-origine"]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [RADIUS_SOURCE, ORIGIN_SOURCE]) if (map.getSource(id)) map.removeSource(id);
  if (!origin) return;

  const color = yearColor();
  map.addSource(RADIUS_SOURCE, {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circlePolygon(origin, radius)] } },
  });
  map.addSource(ORIGIN_SOURCE, {
    type: "geojson",
    data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [origin.lng, origin.lat] } },
  });
  map.addLayer({ id: "spot-tomi-rayon-fond", type: "fill", source: RADIUS_SOURCE, paint: { "fill-color": color, "fill-opacity": 0.16 } });
  map.addLayer({
    id: "spot-tomi-rayon-bord",
    type: "line",
    source: RADIUS_SOURCE,
    paint: { "line-color": theme === "dark" ? "#F4F3EF" : "#111111", "line-width": 2, "line-dasharray": [2, 2] },
  });
  map.addLayer({
    id: "spot-tomi-origine",
    type: "circle",
    source: ORIGIN_SOURCE,
    paint: { "circle-radius": 5, "circle-color": "#111111", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
}

/**
 * Petit sélecteur de position (MapLibre, tuiles OpenFreeMap) : le sticker est
 * sous le repère fixe au centre, on déplace la carte (doigt, souris ou
 * flèches du clavier). Avec une position GPS, le déplacement est limité à
 * `radius` mètres autour d'elle.
 */
export default function PositionPicker({ origin, value, fallbackCenter, radius, onCenterChange, className }: PositionPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({ origin, radius, onCenterChange });
  const start = useRef({ value, origin, fallbackCenter });
  const { resolvedTheme } = useTheme();
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";
  const themeRef = useRef<Theme>(theme);
  const [unavailable, setUnavailable] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    latest.current = { origin, radius, onCenterChange };
    const map = mapRef.current;
    if (map?.isStyleLoaded()) drawOverlay(map, origin, radius, themeRef.current);
  }, [origin, radius, onCenterChange]);

  // Création de la carte (une fois).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;

    (async () => {
      const maplibre = await import("maplibre-gl");
      // Worker de MapLibre servi comme fichier statique par la build.
      maplibre.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
      const style: StyleSpecification | null = await loadMapStyle(themeRef.current);
      if (cancelled || !containerRef.current) return;
      if (!style) setUnavailable(true);

      const { value: initial, origin: from, fallbackCenter: fallback } = start.current;
      const center = initial ?? from ?? fallback;
      map = new maplibre.Map({
        container: containerRef.current,
        style: style ?? fallbackStyle(themeRef.current),
        center: center ? [center.lng, center.lat] : [8, 28],
        zoom: initial || from ? 16 : fallback ? 11 : 1.2,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
        locale: tp.picker.mapLocale,
      });
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      map.getCanvas().setAttribute("aria-label", tp.picker.mapLabel);
      map.on("style.load", () => {
        if (map) drawOverlay(map, latest.current.origin, latest.current.radius, themeRef.current);
      });
      map.on("moveend", () => {
        if (!map) return;
        const c = map.getCenter();
        const point = { lat: c.lat, lng: normalizeLng(c.lng) };
        const { origin: limit, radius: max, onCenterChange: report } = latest.current;
        if (limit) {
          const clamped = clampToRadius(limit, point, max);
          if (distanceMeters(clamped, point) > 0.5) {
            map.easeTo({ center: [clamped.lng, clamped.lat], duration: prefersReducedMotion() ? 0 : 250 });
            return;
          }
        }
        report(point, map.getZoom());
      });
      // Conteneur masqué puis affiché (mobile), ou redimensionné : la carte suit.
      observer = new ResizeObserver(() => map?.resize());
      observer.observe(containerRef.current);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Changement de thème : autre fond de carte.
  useEffect(() => {
    if (themeRef.current === theme) return;
    themeRef.current = theme;
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    loadMapStyle(theme).then((style) => {
      if (cancelled || mapRef.current !== map) return;
      setUnavailable(!style);
      map.setStyle(style ?? fallbackStyle(theme));
    });
    return () => {
      cancelled = true;
    };
  }, [theme]);

  function flyTo(point: LatLng, zoom?: number) {
    mapRef.current?.flyTo({
      center: [point.lng, point.lat],
      zoom: zoom ?? Math.max(mapRef.current.getZoom(), 15),
      duration: prefersReducedMotion() ? 0 : 800,
    });
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocationError(true);
      return;
    }
    setLocating(true);
    setLocationError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        flyTo({ lat: position.coords.latitude, lng: position.coords.longitude }, 16);
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const controlClass =
    "flex min-h-11 items-center gap-2 rounded-full bg-card px-3.5 text-[13px] font-bold text-text shadow-card focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text disabled:opacity-60";

  return (
    <div className={cn("relative min-h-0 flex-1 overflow-hidden bg-soft", className)}>
      {/* MapLibre impose position: relative à son conteneur : il remplit donc un parent positionné. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="size-full" data-testid="position-map" />
      </div>

      {/* Repère fixe : la pointe est exactement au centre de la carte. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <MapMarker points={45} pending />
        <span className="h-3 w-0.5 bg-band" />
      </div>
      <span
        role="img"
        aria-label={tp.picker.marker}
        className="pointer-events-none absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-band"
      />

      <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
        {origin ? (
          <button type="button" className={controlClass} onClick={() => flyTo(origin)}>
            <UndoIcon size={18} />
            {tp.picker.reset}
          </button>
        ) : (
          <button type="button" className={controlClass} onClick={locate} disabled={locating}>
            <LocateIcon size={18} />
            {locating ? tp.picker.locating : tp.picker.myLocation}
          </button>
        )}
        {locationError && (
          <p role="status" className="max-w-60 rounded-[12px] bg-card px-3 py-2 text-xs font-semibold shadow-card">
            {tp.picker.locationDenied}
          </p>
        )}
        {unavailable && (
          <p role="status" className="max-w-60 rounded-[12px] bg-card px-3 py-2 text-xs font-semibold shadow-card">
            {tp.picker.mapUnavailable}
          </p>
        )}
      </div>
    </div>
  );
}

