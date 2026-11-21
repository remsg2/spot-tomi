"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { tm } from "@/i18n/map.fr";
import { cn } from "@/lib/cn";
import { searchSpots } from "@/lib/map/data";
import { DEFAULT_FILTERS, setMine, setPerson, toggleYear } from "@/lib/map/filters";
import type { SearchResult } from "@/lib/map/types";
import { Chip } from "./filter-chips";
import { CloseIcon } from "./icons";
import { useMapContext } from "./map-provider";

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
    >
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-year" : "bg-soft",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-card shadow transition-[left]",
            checked ? "left-6" : "left-1",
          )}
        />
      </span>
    </button>
  );
}

/** Panneau de filtres (feuille en bas sur mobile, fenêtre centrée en web). */
export function FilterDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filters, setFilters, seasons, userId, getSupabase } = useMapContext();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [personQuery, setPersonQuery] = useState("");
  const [people, setPeople] = useState<SearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  function searchPeople(value: string) {
    setPersonQuery(value);
    clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setPeople([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      try {
        const rows = await searchSpots(supabase, q, new AbortController().signal);
        setPeople(rows.filter((row) => row.kind === "user"));
      } catch {
        setPeople([]);
      }
    }, 250);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="filters-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[26px] bg-card p-0 text-text shadow-card-lg backdrop:bg-black/40 md:m-auto md:max-w-md md:rounded-[22px]"
    >
      <div className="flex flex-col gap-5 p-5 pb-[calc(20px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 id="filters-title" className="font-display text-xl font-normal">
            {tm.filters.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tm.filters.close}
            className="flex size-11 items-center justify-center rounded-full bg-soft"
          >
            <CloseIcon />
          </button>
        </div>

        {seasons.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-extrabold tracking-[0.1em] text-muted uppercase">{tm.filters.years}</h3>
            <div className="flex flex-wrap gap-2">
              {seasons.map((season) => {
                const pressed = filters.years.includes(season.year);
                return (
                  <Chip
                    key={season.year}
                    pressed={pressed}
                    activeStyle={season.color_hex}
                    label={tm.filters.year(season.year)}
                    onClick={() => setFilters((previous) => toggleYear(previous, season.year))}
                  >
                    {!pressed && (
                      <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: season.color_hex }} />
                    )}
                    {season.year}
                  </Chip>
                );
              })}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-extrabold tracking-[0.1em] text-muted uppercase">{tm.filters.person}</h3>
          {filters.person ? (
            <Chip
              pressed
              activeStyle="var(--soft)"
              label={tm.filters.clearPerson(filters.person.username)}
              onClick={() => setFilters((previous) => setPerson(previous, null))}
              className="self-start"
            >
              <span className="text-text">{tm.filters.personOf(filters.person.username)}</span>
              <CloseIcon size={14} className="text-text" />
            </Chip>
          ) : (
            <>
              <label className="flex h-12 items-center rounded-[14px] bg-soft px-3.5">
                <span className="sr-only">{tm.filters.person}</span>
                <input
                  type="search"
                  value={personQuery}
                  onChange={(event) => searchPeople(event.target.value)}
                  placeholder={tm.filters.personPlaceholder}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-muted"
                />
              </label>
              {people.length > 0 && (
                <ul className="flex flex-col">
                  {people.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setFilters((previous) => setPerson(previous, { id: person.id, username: person.label }));
                          setPersonQuery("");
                          setPeople([]);
                        }}
                        className="flex min-h-11 w-full items-center justify-between rounded-[12px] px-3 text-left hover:bg-soft"
                      >
                        <span className="text-sm font-semibold">@{person.label}</span>
                        <span className="text-xs text-muted">{tm.search.personDetail(person.spot_count ?? 0)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <Toggle
            checked={filters.rare}
            onChange={() => setFilters((previous) => ({ ...previous, rare: !previous.rare }))}
            label={tm.filters.rare}
            hint={tm.filters.rareHint}
          />
          {userId ? (
            <Toggle
              checked={filters.mine}
              onChange={() => setFilters((previous) => setMine(previous, !previous.mine))}
              label={tm.filters.mine}
            />
          ) : (
            <Link href="/login?next=/" className="flex min-h-11 items-center text-[15px] font-semibold underline">
              {tm.filters.mineLogin}
            </Link>
          )}
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="min-h-14 flex-1 rounded-[18px] bg-soft px-4 text-[15px] font-semibold"
          >
            {tm.filters.reset}
          </button>
          <PrimaryButton className="flex-1" onClick={onClose}>
            {tm.filters.apply}
          </PrimaryButton>
        </div>
      </div>
    </dialog>
  );
}
