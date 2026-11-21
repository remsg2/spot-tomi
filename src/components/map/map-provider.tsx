"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { spotIdFromPath } from "@/components/shell/routes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { DEFAULT_FILTERS, type MapFilters } from "@/lib/map/filters";
import type { CameraTarget } from "@/lib/map/search";
import type { Season } from "@/lib/map/types";
import { fetchSeasons } from "@/lib/map/data";
import type { VisibleSummary } from "@/lib/map/visible";

/** Commandes exposées par la carte une fois montée (zoom, cadrage, localisation). */
export type MapCommands = {
  zoomIn: () => void;
  zoomOut: () => void;
  goTo: (target: CameraTarget) => void;
  locate: () => void;
};

export type Camera = { center: [number, number]; zoom: number };

export type MapStatus = {
  loading: boolean;
  dataError: boolean;
  truncated: boolean;
  /** Fond simplifié : les tuiles OpenFreeMap ne répondent pas. */
  offlineTiles: boolean;
  noWebgl: boolean;
};

type MapContextValue = {
  filters: MapFilters;
  setFilters: (update: MapFilters | ((previous: MapFilters) => MapFilters)) => void;
  seasons: Season[];
  userId: string | null;
  /** Sticker de la fiche ouverte (web) ou de la carte résumée (mobile). */
  selectedId: string | null;
  /** Carte résumée en bas de l'écran (mobile). */
  summaryId: string | null;
  openSummary: (id: string | null) => void;
  /** Position du sticker de la fiche ouverte, pour la carte de droite. */
  focus: { id: string; lng: number; lat: number } | null;
  setFocus: (focus: { id: string; lng: number; lat: number } | null) => void;
  visible: VisibleSummary;
  setVisible: (summary: VisibleSummary) => void;
  status: MapStatus;
  setStatus: (patch: Partial<MapStatus>) => void;
  /** Dernière vue de la carte, conservée quand elle est démontée (mobile). */
  cameraRef: React.RefObject<Camera | null>;
  commands: React.RefObject<MapCommands | null>;
  getSupabase: () => SupabaseClient | null;
  /** Message lu par les lecteurs d'écran et affiché brièvement. */
  announce: (message: string) => void;
  message: string | null;
};

const MapContext = createContext<MapContextValue | null>(null);

export function useMapContext(): MapContextValue {
  const context = useContext(MapContext);
  if (!context) throw new Error("useMapContext doit être utilisé sous <MapProvider>.");
  return context;
}

const EMPTY_VISIBLE: VisibleSummary = { count: 0, points: 0, top: [] };

/**
 * État partagé de la carte, au niveau du gabarit : il survit aux navigations entre
 * la carte et les fiches (filtres, vue, sélection).
 */
export function MapProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [focus, setFocus] = useState<MapContextValue["focus"]>(null);
  const [visible, setVisible] = useState<VisibleSummary>(EMPTY_VISIBLE);
  const [status, setStatusState] = useState<MapStatus>({
    loading: false,
    dataError: false,
    truncated: false,
    offlineTiles: false,
    noWebgl: false,
  });
  const [message, setMessage] = useState<string | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const commands = useRef<MapCommands | null>(null);
  const supabaseRef = useRef<SupabaseClient | null | undefined>(undefined);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const getSupabase = useCallback(() => {
    if (supabaseRef.current === undefined) {
      try {
        supabaseRef.current = getSupabaseBrowserClient();
      } catch {
        // Configuration absente : la carte s'affiche sans stickers.
        supabaseRef.current = null;
      }
    }
    return supabaseRef.current;
  }, []);

  const setStatus = useCallback((patch: Partial<MapStatus>) => {
    setStatusState((previous) => {
      const next = { ...previous, ...patch };
      return (Object.keys(patch) as (keyof MapStatus)[]).every((key) => previous[key] === next[key])
        ? previous
        : next;
    });
  }, []);

  const announce = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(null), 4000);
  }, []);

  useEffect(() => () => clearTimeout(messageTimer.current), []);

  // Années et couleurs pour les filtres ; session pour « Mes stickers ».
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    fetchSeasons(supabase)
      .then((rows) => {
        if (!cancelled) setSeasons(rows);
      })
      .catch(() => {});
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setUserId(data.session?.user.id ?? null);
      })
      .catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [getSupabase]);

  // Sans session, le filtre « Mes stickers » n'a pas de sens.
  const effectiveFilters = useMemo(
    () => (filters.mine && !userId ? { ...filters, mine: false } : filters),
    [filters, userId],
  );

  const pathSpotId = spotIdFromPath(pathname);
  const selectedId = pathSpotId ?? summaryId;

  const value = useMemo<MapContextValue>(
    () => ({
      filters: effectiveFilters,
      setFilters,
      seasons,
      userId,
      selectedId,
      summaryId: pathname === "/" ? summaryId : null,
      openSummary: setSummaryId,
      focus: focus && focus.id === pathSpotId ? focus : null,
      setFocus,
      visible,
      setVisible,
      status,
      setStatus,
      cameraRef,
      commands,
      getSupabase,
      announce,
      message,
    }),
    [
      effectiveFilters,
      seasons,
      userId,
      selectedId,
      pathname,
      summaryId,
      focus,
      pathSpotId,
      visible,
      status,
      setStatus,
      getSupabase,
      announce,
      message,
    ],
  );

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}
