"use client";

import { useId, useState } from "react";
import { Sticker } from "@/components/ui";
import { ta } from "@/i18n/admin.fr";
import { SEASON_SWATCHES } from "@/lib/admin/swatches";
import type { MissingSeasonYear, Season, SeasonActionResult } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { FALLBACK_YEAR_COLOR } from "@/lib/design/color";
import {
  checkYearColor,
  SEASON_YEAR_MAX,
  SEASON_YEAR_MIN,
  yearColorError,
} from "@/lib/validation/admin";
import { ActionMessage } from "./action-message";
import { SeasonPreview } from "./season-preview";
import { buttonStrong, card, sectionTitle, warnBox } from "./styles";
import { SubmitButton } from "./submit-button";

export type SeasonEditorProps = {
  seasons: Season[];
  missingYears: MissingSeasonYear[];
  /** Année proposée à l'ouverture (saison en cours, sinon l'année civile). */
  initialYear: number;
  /** Année de la saison en cours, null si aucune. */
  currentYear: number | null;
  action: (form: FormData) => Promise<SeasonActionResult>;
};

/**
 * Onglet Couleur (docs/maquettes/Admin.dc.html). L'aperçu suit la saisie sans
 * toucher au reste de l'app ; « Appliquer » reste désactivé tant que le texte
 * noir n'atteint pas 4,5:1 sur la couleur. La Server Action revérifie, et la
 * base aussi (admin_set_season).
 */
export function SeasonEditor({ seasons, missingYears, initialYear, currentYear, action }: SeasonEditorProps) {
  const ids = useId();
  const colorOf = (year: number) => seasons.find((season) => season.year === year)?.color_hex ?? null;
  const defaultCurrent = (year: number) => currentYear === null || year >= currentYear;

  const [yearText, setYearText] = useState(String(initialYear));
  const [hex, setHex] = useState<string>(colorOf(initialYear) ?? SEASON_SWATCHES[0]);
  const [makeCurrent, setMakeCurrent] = useState(defaultCurrent(initialYear));
  const [result, setResult] = useState<SeasonActionResult | null>(null);

  const parsedYear = Number(yearText);
  const yearValid = Number.isInteger(parsedYear) && parsedYear >= SEASON_YEAR_MIN && parsedYear <= SEASON_YEAR_MAX;
  const year = yearValid ? parsedYear : initialYear;
  const check = checkYearColor(hex);
  const error = yearColorError(check);
  const preview = check.color ?? FALLBACK_YEAR_COLOR;

  function selectYear(next: number) {
    setYearText(String(next));
    const existing = colorOf(next);
    if (existing) setHex(existing);
    setMakeCurrent(defaultCurrent(next));
    setResult(null);
  }

  async function submit(form: FormData) {
    const outcome = await action(form);
    setResult(outcome);
    // L'admin voit tout de suite l'app recolorée ; les autres pages suivront
    // au prochain chargement (cache revalidé côté serveur).
    if (outcome.ok && outcome.makeCurrent && outcome.color) {
      document.documentElement.style.setProperty("--year", outcome.color);
    }
  }

  const statusId = `${ids}-status`;

  return (
    <div className="flex flex-col gap-3.5">
      {missingYears.length > 0 && (
        <section aria-labelledby={`${ids}-missing`} className={cn(warnBox, "flex flex-col gap-2")}>
          <h2 id={`${ids}-missing`} className="text-sm font-extrabold">
            {ta.season.missingTitle}
          </h2>
          <p>{ta.season.missingIntro}</p>
          <ul className="flex flex-wrap gap-2">
            {missingYears.map(({ year: missing, spot_count }) => (
              <li key={missing}>
                <button
                  type="button"
                  onClick={() => selectYear(missing)}
                  aria-label={ta.season.pickYear(missing)}
                  className="min-h-11 rounded-full border border-current px-3 text-[13px] font-bold"
                >
                  {ta.season.missingYear(missing, spot_count)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {currentYear === null && <p className={warnBox}>{ta.season.noCurrent}</p>}

      <form action={submit} className={cn(card, "flex flex-col gap-3.5")} aria-labelledby={`${ids}-title`}>
        <div className="flex flex-col gap-0.5">
          <h2 id={`${ids}-title`} className={sectionTitle}>
            {ta.season.title(year)}
          </h2>
          <span className="text-xs text-muted">{ta.season.intro}</span>
        </div>

        <SeasonPreview
          color={preview}
          year={year}
          note={
            <span id={statusId} aria-live="polite" className={cn("text-xs font-semibold", error ? "text-text" : "text-muted")}>
              {error ? null : ta.season.readable}
              {check.ratio !== null && !error && (
                <span className="block font-normal">{ta.season.contrast(check.ratio)}</span>
              )}
            </span>
          }
        />

        <fieldset>
          <legend className="sr-only">{ta.season.swatchesLabel}</legend>
          <div className="grid grid-cols-8 gap-2">
            {SEASON_SWATCHES.map((swatch) => {
              const on = check.color === swatch;
              return (
                <button
                  key={swatch}
                  type="button"
                  data-swatch={swatch}
                  aria-label={ta.season.swatches[swatch]}
                  aria-pressed={on}
                  onClick={() => {
                    setHex(swatch);
                    setResult(null);
                  }}
                  className="aspect-square rounded-[10px] border-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
                  style={{
                    background: swatch,
                    boxShadow: on
                      ? "0 0 0 3px var(--card), 0 0 0 5px var(--text)"
                      : "inset 0 0 0 1px rgb(0 0 0 / 0.08)",
                  }}
                />
              );
            })}
          </div>
        </fieldset>

        <div className="flex gap-2">
          <div className="flex min-h-[46px] flex-1 items-center gap-2.5 rounded-[12px] border border-line px-3 text-sm focus-within:outline-3 focus-within:outline-offset-1 focus-within:outline-text">
            <input
              type="color"
              aria-label={ta.season.pickerLabel}
              value={(check.color ?? FALLBACK_YEAR_COLOR).toLowerCase()}
              onChange={(event) => {
                setHex(event.target.value.toUpperCase());
                setResult(null);
              }}
              className="size-[18px] shrink-0 cursor-pointer appearance-none overflow-hidden rounded-[5px] border-0 p-0 [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
            />
            <input
              name="colorHex"
              value={hex}
              onChange={(event) => {
                setHex(event.target.value);
                setResult(null);
              }}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              aria-label={ta.season.hexLabel}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${ids}-error` : statusId}
              className="w-full min-w-0 bg-transparent font-mono text-[15px] font-bold uppercase outline-none"
            />
          </div>
          <SubmitButton
            className={buttonStrong}
            disabled={Boolean(error) || !yearValid}
            aria-describedby={error ? `${ids}-error` : undefined}
          >
            {ta.season.apply}
          </SubmitButton>
        </div>

        {error && (
          <p id={`${ids}-error`} role="alert" className="text-sm font-semibold text-[#B42318] dark:text-[#F87171]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            {ta.season.yearLabel}
            <input
              name="year"
              type="number"
              inputMode="numeric"
              min={SEASON_YEAR_MIN}
              max={SEASON_YEAR_MAX}
              value={yearText}
              onChange={(event) => {
                setYearText(event.target.value);
                setResult(null);
                const next = Number(event.target.value);
                if (Number.isInteger(next)) {
                  const existing = colorOf(next);
                  if (existing) setHex(existing);
                  setMakeCurrent(defaultCurrent(next));
                }
              }}
              className="min-h-11 w-24 rounded-[12px] border border-line bg-card px-3 text-[15px] font-bold"
            />
          </label>
          <label className="flex min-h-11 flex-1 items-center gap-2 text-sm font-semibold">
            <input
              name="makeCurrent"
              type="checkbox"
              checked={makeCurrent}
              onChange={(event) => setMakeCurrent(event.target.checked)}
              aria-describedby={`${ids}-current-hint`}
              className="size-5 accent-[var(--text)]"
            />
            {ta.season.makeCurrent}
          </label>
          <p id={`${ids}-current-hint`} className="w-full text-xs text-muted">
            {ta.season.makeCurrentHint}
          </p>
        </div>

        <ActionMessage result={result} />
      </form>

      {seasons.length > 0 && (
        <section aria-labelledby={`${ids}-all`} className="flex flex-col gap-2">
          <h2 id={`${ids}-all`} className="font-display text-base font-normal">
            {ta.season.allSeasons}
          </h2>
          <ul className="flex flex-wrap gap-3">
            {seasons.map((season) => (
              <li key={season.year}>
                <button
                  type="button"
                  onClick={() => selectYear(season.year)}
                  aria-label={ta.season.editYear(season.year)}
                  aria-pressed={yearValid && parsedYear === season.year}
                  className="flex min-h-11 flex-col items-center gap-1 rounded-[12px] p-1 aria-pressed:bg-soft"
                >
                  <Sticker size={56} color={season.color_hex} band={String(season.year)} />
                  <span className="text-[11px] font-semibold text-muted">
                    {season.is_current ? ta.season.current : season.color_hex}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
