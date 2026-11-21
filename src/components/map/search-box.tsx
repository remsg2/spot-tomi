"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { searchSpots } from "@/lib/map/data";
import { setPerson } from "@/lib/map/filters";
import { flattenResults, groupResults, targetForResult } from "@/lib/map/search";
import type { SearchResult } from "@/lib/map/types";
import { SearchIcon } from "./icons";
import { useMapContext } from "./map-provider";

const DEBOUNCE_MS = 250;

/**
 * Recherche d'un lieu, d'un pays ou d'une personne (search_spots), en liste
 * déroulante accessible au clavier (motif ARIA « combobox »).
 */
export function SearchBox({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { getSupabase, setFilters, commands, selectedId } = useMapContext();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abort = useRef<AbortController | null>(null);

  const groups = useMemo(() => groupResults(results), [results]);
  const flat = useMemo(() => flattenResults(groups), [groups]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  function onChange(value: string) {
    setQuery(value);
    setActive(-1);
    clearTimeout(timer.current);
    abort.current?.abort();
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setOpen(true);
    setSearching(true);
    timer.current = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setSearching(false);
        return;
      }
      const controller = new AbortController();
      abort.current = controller;
      try {
        const rows = await searchSpots(supabase, q, controller.signal);
        if (!controller.signal.aborted) setResults(rows);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, DEBOUNCE_MS);
  }

  function pick(result: SearchResult) {
    setOpen(false);
    setActive(-1);
    const target = targetForResult(result);
    if (result.kind === "user") {
      setFilters((previous) => setPerson(previous, { id: result.id, username: result.label }));
      setQuery("");
    } else {
      setQuery(result.label);
    }
    if (target) commands.current?.goTo(target);
    if (result.kind === "spot") {
      // Sur mobile, d'une fiche à l'autre sans empiler l'historique : « fermer » revient à la carte.
      const wide = window.matchMedia("(min-width: 768px)").matches;
      if (!wide && selectedId) router.replace(`/spots/${result.id}`);
      else router.push(`/spots/${result.id}`);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && flat.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % flat.length);
    } else if (event.key === "ArrowUp" && flat.length > 0) {
      event.preventDefault();
      setActive((index) => (index <= 0 ? flat.length - 1 : index - 1));
    } else if (event.key === "Enter" && open && active >= 0 && flat[active]) {
      event.preventDefault();
      pick(flat[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  const sections: { kind: SearchResult["kind"]; title: string }[] = [
    { kind: "spot", title: tm.search.places },
    { kind: "country", title: tm.search.countries },
    { kind: "user", title: tm.search.people },
  ];

  return (
    <div className={cn("relative min-w-0", className)}>
      <label
        className={cn(
          "flex items-center gap-2.5 rounded-[14px] bg-card px-3.5 text-muted shadow-card focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-text",
          compact ? "h-11" : "h-12",
        )}
      >
        <SearchIcon />
        <span className="sr-only">{tm.search.label}</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          placeholder={tm.search.placeholder}
          value={query}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          enterKeyHint="search"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-text outline-none placeholder:text-muted"
        />
      </label>
      <div
        id={listId}
        role="listbox"
        aria-label={tm.search.label}
        hidden={!open}
        className="absolute top-full right-0 left-0 z-30 mt-2 max-h-[min(60vh,420px)] overflow-y-auto rounded-[18px] bg-card p-2 shadow-card-lg"
      >
        {searching && results.length === 0 && <p className="px-3 py-2 text-sm text-muted">{tm.search.searching}</p>}
        {!searching && results.length === 0 && <p className="px-3 py-2 text-sm text-muted">{tm.search.empty}</p>}
        {sections.map(({ kind, title }) =>
          groups[kind].length === 0 ? null : (
            <div key={kind} role="group" aria-label={title} className="py-1">
              <p aria-hidden="true" className="px-3 pt-1 pb-1 text-[11px] font-extrabold tracking-[0.1em] text-muted uppercase">
                {title}
              </p>
              {groups[kind].map((result) => {
                const index = flat.indexOf(result);
                const detail =
                  kind === "spot"
                    ? result.detail
                    : kind === "country"
                      ? tm.search.countryDetail(result.spot_count ?? 0)
                      : tm.search.personDetail(result.spot_count ?? 0);
                return (
                  <div
                    key={`${kind}-${result.id}`}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(result)}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 py-1.5 aria-selected:bg-soft hover:bg-soft"
                  >
                    <span
                      aria-hidden="true"
                      className={cn("size-3 shrink-0", kind === "user" ? "rounded-full bg-band" : "rounded-[3px]")}
                      style={kind === "spot" ? { background: result.color ?? undefined } : kind === "country" ? { background: "var(--dash)" } : undefined}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">
                        {kind === "user" ? `@${result.label}` : result.label}
                      </span>
                      {detail && <span className="truncate text-xs text-muted">{detail}</span>}
                    </span>
                    {kind === "spot" && result.points !== null && (
                      <span className="font-display text-sm">+{result.points}</span>
                    )}
                  </div>
                );
              })}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
