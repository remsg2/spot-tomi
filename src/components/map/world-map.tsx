"use client";

import {
  getVersion,
  Map as MapLibreMap,
  setWorkerUrl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect, useRef } from "react";
import { tm } from "@/i18n/map.fr";
import { containsArgs, containsPoint, padBounds, toBboxArgs, type BboxArgs, type Bounds } from "@/lib/map/bbox";
import { fetchCountryRarity, fetchSpotsInBbox } from "@/lib/map/data";
import { filtersKey, filtersToRpc } from "@/lib/map/filters";
import {
  clusterIconExpression,
  clusterKeyFromProperties,
  clusterProperties,
  clusterSlots,
  parseClusterKey,
  sameSlots,
} from "@/lib/map/clusters";
import { markerIconExpression, markerKey, parseMarkerKey } from "@/lib/map/markers";
import { RARITY_MAX_ZOOM, rarityPaint, rarityPalette } from "@/lib/map/rarity";
import type { CameraTarget } from "@/lib/map/search";
import {
  BASE_STYLE_URLS,
  COUNTRIES_TOLERANCE,
  COUNTRIES_URL,
  FALLBACK_OUTLINE_LAYER,
  fallbackStyle,
  firstSymbolLayerId,
  MAP_COLORS,
  patchBaseStyle,
} from "@/lib/map/style";
import { EMPTY_COLLECTION, type CountryRarity, type SpotCollection, type ThemeName } from "@/lib/map/types";
import { summarizeVisible } from "@/lib/map/visible";
import { haptic } from "@/lib/haptics";
import { canGoBackInApp } from "@/lib/navigation/back";
import { drawCluster, drawMarker, loadMarkerAssets, type MarkerAssets } from "./marker-images";
import { useMapContext } from "./map-provider";

const SOURCE_SPOTS = "spots";
const SOURCE_COUNTRIES = "countries";
const SOURCE_ME = "me";
const LAYER_RARITY = "countries-rarity";
const LAYER_CLUSTERS = "spots-clusters";
const LAYER_MARKERS = "spots-markers";
const LAYER_SELECTED = "spots-selected";
const LAYER_ME = "me-dot";
const INTERACTIVE_LAYERS = [LAYER_SELECTED, LAYER_MARKERS, LAYER_CLUSTERS];

/** Anti-rebond du chargement par zone visible. */
const LOAD_DEBOUNCE_MS = 250;
/** Préchargement autour de la vue (50 % de chaque côté). */
const PREFETCH_RATIO = 0.5;
/** Au-delà, les images de marqueurs inutilisées sont libérées. */
const MAX_IMAGES = 300;
const STYLE_TIMEOUT_MS = 5000;

const DEFAULT_CAMERA = { center: [8, 30] as [number, number], zoom: 1.4 };

function boundsOf(map: MapLibreMap): Bounds {
  const b = map.getBounds();
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasWebgl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Amène le sticker de la fiche ouverte dans la vue. Sur mobile (`bottomInset` :
 * hauteur cachée par le tiroir), il est centré dans la partie visible au-dessus
 * du tiroir ; en web, la carte ne bouge pas si on le voit déjà.
 */
function showFocus(map: MapLibreMap, focus: { lng: number; lat: number }, bottomInset = 0) {
  if (bottomInset > 0) {
    map.easeTo({
      center: [focus.lng, focus.lat],
      zoom: map.getZoom() < 3 ? 9 : map.getZoom(),
      padding: { top: 0, right: 0, left: 0, bottom: bottomInset },
      duration: reducedMotion() ? 0 : 600,
    });
    return;
  }
  const inside = containsPoint(toBboxArgs(boundsOf(map)), focus.lng, focus.lat);
  if (!inside || map.getZoom() < 3) {
    map.flyTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 9), duration: reducedMotion() ? 0 : 900 });
  }
}

const styleCache = new Map<ThemeName, StyleSpecification>();

/** Style OpenFreeMap recoloré, ou fond simplifié si les tuiles ne répondent pas. */
async function loadBaseStyle(theme: ThemeName): Promise<{ style: StyleSpecification; offline: boolean }> {
  const cached = styleCache.get(theme);
  if (cached) return { style: cached, offline: false };
  try {
    const response = await fetch(BASE_STYLE_URLS[theme], { signal: AbortSignal.timeout(STYLE_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const style = patchBaseStyle((await response.json()) as StyleSpecification, theme);
    styleCache.set(theme, style);
    return { style, offline: false };
  } catch {
    return { style: fallbackStyle(theme, new URL(COUNTRIES_URL, window.location.origin).href), offline: true };
  }
}

/**
 * Carte mondiale MapLibre : tuiles OpenFreeMap, pays colorés par rareté au
 * dézoom, stickers chargés par zone visible et regroupés par année (un sticker
 * de Tomi par année présente, avec son nombre de stickers). Tout est rendu en
 * couches GL (aucun marqueur DOM), pour rester fluide avec 5 000 stickers.
 */
export default function WorldMap() {
  const context = useMapContext();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const theme: ThemeName = resolvedTheme === "dark" ? "dark" : "light";

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const assetsRef = useRef<MarkerAssets | null>(null);
  const imagesRef = useRef(new Set<string>());
  const dataRef = useRef<SpotCollection>(EMPTY_COLLECTION);
  /** Couleurs d'année comptées dans chaque groupe, dans l'ordre des années. */
  const slotsRef = useRef<string[]>([]);
  const rarityRef = useRef<CountryRarity[]>([]);
  const lastLoadRef = useRef<{ args: BboxArgs; key: string; truncated: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const themeRef = useRef<ThemeName>(theme);
  const appliedThemeRef = useRef<ThemeName | null>(null);
  const meRef = useRef<[number, number] | null>(null);
  /** Fond simplifié en cours (tuiles injoignables). */
  const offlineRef = useRef(false);

  // Les gestionnaires MapLibre lisent toujours l'état le plus récent.
  const live = useRef(context);
  const routerRef = useRef(router);
  useLayoutEffect(() => {
    live.current = context;
    routerRef.current = router;
  });

  const filterKey = filtersKey(context.filters);
  const { selectedId, focus, seasons, bottomInset } = context;

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  // Création de la carte (une fois).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { setStatus, cameraRef } = live.current;
    if (!hasWebgl()) {
      setStatus({ noWebgl: true });
      return;
    }

    let cancelled = false;
    let map: MapLibreMap | null = null;
    setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

    const updateVisible = () => {
      if (!map) return;
      const view = toBboxArgs(boundsOf(map));
      live.current.setVisible(summarizeVisible(dataRef.current.features, view));
    };

    const loadSpots = async (force: boolean) => {
      if (!map) return;
      const supabase = live.current.getSupabase();
      if (!supabase) {
        live.current.setStatus({ dataError: true });
        return;
      }
      const filters = live.current.filters;
      const key = filtersKey(filters);
      const view = toBboxArgs(boundsOf(map));
      const last = lastLoadRef.current;
      if (!force && last && last.key === key && !last.truncated && containsArgs(last.args, view)) {
        updateVisible();
        return;
      }
      const args = toBboxArgs(padBounds(boundsOf(map), PREFETCH_RATIO));
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      live.current.setStatus({ loading: true });
      try {
        const collection = await fetchSpotsInBbox(supabase, args, filtersToRpc(filters), controller.signal);
        if (controller.signal.aborted || !map) return;
        dataRef.current = collection;
        lastLoadRef.current = { args, key, truncated: Boolean(collection.truncated) };
        // Une année encore inconnue reçoit son créneau : la source est alors recréée avec les données.
        if (!syncSlots()) (map.getSource(SOURCE_SPOTS) as GeoJSONSource | undefined)?.setData(collection);
        live.current.setStatus({ loading: false, dataError: false, truncated: Boolean(collection.truncated) });
        updateVisible();
      } catch {
        if (controller.signal.aborted) return;
        live.current.setStatus({ loading: false, dataError: true });
      }
    };

    const scheduleLoad = (force = false) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void loadSpots(force), LOAD_DEBOUNCE_MS);
    };

    const rarityPaintNow = () => {
      const currentTheme = appliedThemeRef.current ?? themeRef.current;
      const palette = rarityPalette(assetsRef.current?.yearColor ?? "#9A9A94", currentTheme);
      return rarityPaint(rarityRef.current, palette, offlineRef.current ? MAP_COLORS[currentTheme].land : null);
    };

    const applyRarity = () => {
      if (!map?.getLayer(LAYER_RARITY)) return;
      const paint = rarityPaintNow();
      map.setPaintProperty(LAYER_RARITY, "fill-color", paint["fill-color"]);
      map.setPaintProperty(LAYER_RARITY, "fill-opacity", paint["fill-opacity"]);
    };

    /** Source des stickers et ses trois couches, sous le point « ma position ». */
    const addSpots = () => {
      if (!map) return;
      const currentTheme = appliedThemeRef.current ?? themeRef.current;
      const slots = slotsRef.current;
      const before = map.getLayer(LAYER_ME) ? LAYER_ME : undefined;
      map.addSource(SOURCE_SPOTS, {
        type: "geojson",
        data: dataRef.current,
        cluster: true,
        clusterRadius: 64,
        clusterMaxZoom: 13,
        clusterProperties: clusterProperties(slots) as never,
      });
      map.addLayer(
        {
          id: LAYER_CLUSTERS,
          type: "symbol",
          source: SOURCE_SPOTS,
          filter: ["has", "point_count"],
          layout: {
            "icon-image": clusterIconExpression(slots, currentTheme),
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-sort-key": ["get", "point_count"],
          },
        },
        before,
      );
      map.addLayer(
        {
          id: LAYER_MARKERS,
          type: "symbol",
          source: SOURCE_SPOTS,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": markerIconExpression(currentTheme, false),
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "symbol-sort-key": ["to-number", ["get", "points"], 0],
          },
        },
        before,
      );
      map.addLayer(
        {
          id: LAYER_SELECTED,
          type: "symbol",
          source: SOURCE_SPOTS,
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], live.current.selectedId ?? ""]],
          layout: {
            "icon-image": markerIconExpression(currentTheme, true),
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        },
        before,
      );
    };

    /**
     * Recalcule les créneaux d'années (saisons connues, puis couleurs des données).
     * S'ils changent, la source est recréée : les clusterProperties d'une source
     * GeoJSON sont fixées à sa création. Renvoie vrai si la source a été recréée.
     */
    const syncSlots = (): boolean => {
      const next = clusterSlots(live.current.seasons, dataRef.current);
      if (sameSlots(next, slotsRef.current)) return false;
      slotsRef.current = next;
      if (!map?.getSource(SOURCE_SPOTS)) return false; // install() la créera
      for (const id of INTERACTIVE_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      map.removeSource(SOURCE_SPOTS);
      addSpots();
      return true;
    };

    /** Sources et couches de l'app, à (ré)installer après chaque changement de fond. */
    const install = () => {
      if (!map) return;
      imagesRef.current.clear();
      slotsRef.current = clusterSlots(live.current.seasons, dataRef.current);
      const style = map.getStyle();
      const beforeLabels = firstSymbolLayerId(style);

      if (!map.getSource(SOURCE_COUNTRIES)) {
        map.addSource(SOURCE_COUNTRIES, {
          type: "geojson",
          data: new URL(COUNTRIES_URL, window.location.origin).href,
          tolerance: COUNTRIES_TOLERANCE,
        });
      }
      // Fond simplifié : la couche dessine aussi les terres, à tous les zooms.
      const offline = offlineRef.current;
      map.addLayer(
        {
          id: LAYER_RARITY,
          type: "fill",
          source: SOURCE_COUNTRIES,
          ...(offline ? {} : { maxzoom: RARITY_MAX_ZOOM }),
          paint: rarityPaintNow(),
        },
        offline && map.getLayer(FALLBACK_OUTLINE_LAYER) ? FALLBACK_OUTLINE_LAYER : beforeLabels,
      );

      addSpots();

      map.addSource(SOURCE_ME, {
        type: "geojson",
        data: meRef.current
          ? { type: "Point", coordinates: meRef.current }
          : { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: LAYER_ME,
        type: "circle",
        source: SOURCE_ME,
        paint: {
          "circle-radius": 8,
          "circle-color": "#2F6FEB",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#FFFFFF",
        },
      });
    };

    /** Images des marqueurs et des groupes, dessinées à la demande. */
    const resolveImage = (id: string) => {
      const assets = assetsRef.current;
      if (!map || !assets || map.hasImage(id)) return;
      const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const marker = parseMarkerKey(id);
      const cluster = marker ? null : parseClusterKey(id);
      if (!marker && !cluster) return;
      const image = marker ? drawMarker(marker, assets, ratio) : drawCluster(cluster!, assets, ratio);
      map.addImage(id, image.data, { pixelRatio: image.pixelRatio });
      imagesRef.current.add(id);
    };

    /** Libère les images qui ne servent plus quand il y en a trop. */
    const pruneImages = () => {
      if (!map || imagesRef.current.size <= MAX_IMAGES) return;
      const used = new Set<string>();
      const currentTheme = appliedThemeRef.current ?? themeRef.current;
      const selected = live.current.selectedId;
      for (const feature of map.queryRenderedFeatures({ layers: INTERACTIVE_LAYERS })) {
        const p = feature.properties as Record<string, unknown>;
        if (typeof p.point_count === "number") {
          used.add(clusterKeyFromProperties(slotsRef.current, p, currentTheme));
        } else {
          const input = {
            points: Number(p.points),
            color: String(p.color),
            gold: p.gold === true,
            pending: p.pending === true,
            theme: currentTheme,
          };
          used.add(markerKey(input));
          if (p.id === selected) used.add(markerKey({ ...input, selected: true }));
        }
      }
      for (const id of [...imagesRef.current]) {
        if (!used.has(id)) {
          map.removeImage(id);
          imagesRef.current.delete(id);
        }
      }
    };

    const pickFeature = (point: { x: number; y: number }): MapGeoJSONFeature | undefined => {
      if (!map) return undefined;
      const pad = 10; // zone de toucher élargie autour des petits marqueurs
      const features = map.queryRenderedFeatures(
        [
          [point.x - pad, point.y - pad],
          [point.x + pad, point.y + pad],
        ],
        { layers: INTERACTIVE_LAYERS.filter((id) => map?.getLayer(id)) },
      );
      const distance = (feature: MapGeoJSONFeature) => {
        if (feature.geometry.type !== "Point") return Infinity;
        const projected = map!.project(feature.geometry.coordinates as [number, number]);
        return Math.hypot(projected.x - point.x, projected.y - point.y);
      };
      return features.sort((a, b) => distance(a) - distance(b))[0];
    };

    const onClick = (event: { point: { x: number; y: number } }) => {
      if (!map) return;
      const feature = pickFeature(event.point);
      const wide = window.matchMedia("(min-width: 768px)").matches;
      if (!feature) {
        // Mobile : toucher la carte autour du tiroir ferme la fiche.
        if (!wide && live.current.selectedId) {
          if (canGoBackInApp()) routerRef.current.back();
          else routerRef.current.replace("/");
        }
        return;
      }
      const properties = feature.properties as Record<string, unknown>;
      if (typeof properties.cluster_id === "number" && feature.geometry.type === "Point") {
        haptic("selection");
        const center = feature.geometry.coordinates as [number, number];
        const source = map.getSource(SOURCE_SPOTS) as GeoJSONSource;
        void source.getClusterExpansionZoom(properties.cluster_id).then((zoom) => {
          map?.easeTo({ center, zoom: zoom + 0.2, duration: reducedMotion() ? 0 : 500 });
        });
        return;
      }
      const id = String(properties.id ?? "");
      if (!id) return;
      haptic("tap");
      // Fiche du sticker : colonne en web, tiroir sur mobile. Sur mobile, d'un sticker à
      // l'autre sans empiler l'historique : « fermer » revient toujours à la carte.
      if (!wide && live.current.selectedId) routerRef.current.replace(`/spots/${id}`);
      else routerRef.current.push(`/spots/${id}`);
    };

    const onMouseMove = (event: { point: { x: number; y: number } }) => {
      if (!map) return;
      map.getCanvas().style.cursor = pickFeature(event.point) ? "pointer" : "";
    };

    const onMoveEnd = () => {
      if (!map) return;
      const center = map.getCenter();
      live.current.cameraRef.current = { center: [center.lng, center.lat], zoom: map.getZoom() };
      updateVisible();
      scheduleLoad();
    };

    const goTo = (target: CameraTarget) => {
      if (!map) return;
      const duration = reducedMotion() ? 0 : 900;
      if (target.type === "fit") {
        map.fitBounds(target.bbox, { padding: 48, maxZoom: 12, duration });
      } else {
        map.flyTo({ center: target.center, zoom: target.zoom, duration });
      }
    };

    const locate = () => {
      const { announce } = live.current;
      if (!("geolocation" in navigator)) {
        announce(tm.map.locateUnsupported);
        return;
      }
      announce(tm.map.locating);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point: [number, number] = [position.coords.longitude, position.coords.latitude];
          meRef.current = point;
          (map?.getSource(SOURCE_ME) as GeoJSONSource | undefined)?.setData({ type: "Point", coordinates: point });
          goTo({ type: "fly", center: point, zoom: 12 });
        },
        () => announce(tm.map.locateDenied),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      );
    };

    (async () => {
      const initialTheme = themeRef.current;
      const [assets, base] = await Promise.all([loadMarkerAssets(), loadBaseStyle(initialTheme)]);
      if (cancelled) return;
      assetsRef.current = assets;
      appliedThemeRef.current = initialTheme;
      offlineRef.current = base.offline;
      setStatus({ offlineTiles: base.offline });

      const camera = cameraRef.current ?? DEFAULT_CAMERA;
      map = new MapLibreMap({
        container,
        style: base.style,
        center: camera.center,
        zoom: camera.zoom,
        minZoom: 0.8,
        maxPitch: 0,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        renderWorldCopies: true,
        fadeDuration: 0,
        cancelPendingTileRequestsWhileZooming: true,
      });
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      mapRef.current = map;
      map.setMissingStyleImageResolver(resolveImage);
      map.on("style.load", install);
      map.on("click", onClick);
      map.on("mousemove", onMouseMove);
      map.on("moveend", onMoveEnd);
      map.on("idle", pruneImages);
      map.once("load", () => {
        updateVisible();
        void loadSpots(true);
        // Fiche ouverte avant que la carte soit prête.
        const pending = live.current.focus;
        if (map && pending) showFocus(map, pending, live.current.bottomInset);
      });
      live.current.commands.current = {
        zoomIn: () => map?.zoomIn({ duration: reducedMotion() ? 0 : 300 }),
        zoomOut: () => map?.zoomOut({ duration: reducedMotion() ? 0 : 300 }),
        goTo,
        locate,
      };

      // Le thème a pu changer pendant le chargement (next-themes) : on le rattrape.
      if (themeRef.current !== initialTheme) {
        container.dispatchEvent(new CustomEvent("spot-tomi:theme", { detail: themeRef.current }));
      }

      const supabase = live.current.getSupabase();
      if (supabase) {
        fetchCountryRarity(supabase)
          .then((rows) => {
            rarityRef.current = rows;
            applyRarity();
          })
          .catch(() => {});
      }
    })();

    // Les autres effets déclenchent ces actions via des événements de la carte.
    const reload = () => scheduleLoad(true);
    const reslot = () => {
      if (map?.getSource(SOURCE_SPOTS)) syncSlots();
    };
    const restyle = (event: Event) => {
      const next = (event as CustomEvent<ThemeName>).detail;
      if (!map || appliedThemeRef.current === next) return;
      void loadBaseStyle(next).then((base) => {
        if (cancelled || !map || themeRef.current !== next) return;
        appliedThemeRef.current = next;
        offlineRef.current = base.offline;
        live.current.setStatus({ offlineTiles: base.offline });
        map.setStyle(base.style, { diff: false });
      });
    };
    container.addEventListener("spot-tomi:reload", reload);
    container.addEventListener("spot-tomi:theme", restyle);
    container.addEventListener("spot-tomi:seasons", reslot);

    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
      container.removeEventListener("spot-tomi:reload", reload);
      container.removeEventListener("spot-tomi:theme", restyle);
      container.removeEventListener("spot-tomi:seasons", reslot);
      live.current.commands.current = null;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Nouveaux filtres : rechargement immédiat de la zone (le premier chargement
  // est fait par la carte elle-même, une fois prête).
  const loadedFilterKey = useRef(filterKey);
  useEffect(() => {
    if (loadedFilterKey.current === filterKey) return;
    loadedFilterKey.current = filterKey;
    containerRef.current?.dispatchEvent(new Event("spot-tomi:reload"));
  }, [filterKey]);

  // Thème clair / sombre : changement de fond (et des images des marqueurs).
  useEffect(() => {
    containerRef.current?.dispatchEvent(new CustomEvent("spot-tomi:theme", { detail: theme }));
  }, [theme]);

  // Saisons chargées ou modifiées : ordre et couleurs des années des groupes.
  useEffect(() => {
    containerRef.current?.dispatchEvent(new Event("spot-tomi:seasons"));
  }, [seasons]);

  // Sticker sélectionné : anneau autour de son marqueur.
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(LAYER_SELECTED)) return;
    map.setFilter(LAYER_SELECTED, ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], selectedId ?? ""]]);
  }, [selectedId]);

  // Fiche ouverte : la carte montre le sticker (au-dessus du tiroir sur mobile).
  // Tiroir fermé : la carte retrouve toute la hauteur.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (focus) {
      showFocus(map, focus, bottomInset);
    } else if ((map.getPadding().bottom ?? 0) > 0) {
      map.easeTo({ padding: { top: 0, right: 0, left: 0, bottom: 0 }, duration: reducedMotion() ? 0 : 300 });
    }
  }, [focus, bottomInset]);

  // Le conteneur de MapLibre reçoit `position: relative` de maplibre-gl.css (hors
  // couches Tailwind, donc prioritaire) : il remplit un parent positionné.
  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        role="region"
        aria-label={tm.map.region}
        data-testid="world-map"
        className="h-full w-full bg-[var(--map-water)]"
      />
    </div>
  );
}
