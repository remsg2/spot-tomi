"use client";

import { useDeferredValue, useId, useState } from "react";
import { ta } from "@/i18n/admin.fr";
import { matchesCountry } from "@/lib/admin/rules";
import type { ActionResult, CountryRow } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { COUNTRY_TIERS } from "@/lib/validation/admin";
import { ActionMessage } from "./action-message";
import { card, input, sectionTitle } from "./styles";

/** Niveaux des pays, avec recherche instantanée (nom sans accents, ISO2 ou ISO3). */
export function CountryTiers({
  countries,
  tierPoints,
  action,
}: {
  countries: CountryRow[];
  /** Points de base de chaque niveau (tier_courant…), pour l'affichage. */
  tierPoints: Record<string, number | undefined>;
  action: (form: FormData) => Promise<ActionResult>;
}) {
  const ids = useId();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [last, setLast] = useState<{ iso2: string; result: ActionResult } | null>(null);
  const shown = countries.filter((country) => matchesCountry(country, deferred));

  return (
    <section aria-labelledby={`${ids}-title`} className={cn(card, "flex flex-col gap-3")}>
      <div className="flex flex-col gap-0.5">
        <h2 id={`${ids}-title`} className={sectionTitle}>
          {ta.scoring.countriesTitle}
        </h2>
        <p className="text-xs text-muted">{ta.scoring.countriesIntro}</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        {ta.scoring.countrySearch}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={ta.scoring.countrySearchPlaceholder}
          className={input}
        />
      </label>
      <p aria-live="polite" className="text-xs text-muted">
        {ta.scoring.countryCount(shown.length, countries.length)}
      </p>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{ta.scoring.noCountry}</p>
      ) : (
        <ul className="-mx-1 max-h-[480px] overflow-y-auto px-1">
          {shown.map((country) => (
            <li key={country.iso2} className="border-b border-line py-1.5 last:border-b-0">
              <form
                action={async (form) => setLast({ iso2: country.iso2, result: await action(form) })}
                className="flex items-center gap-2"
              >
                <input type="hidden" name="iso2" value={country.iso2} />
                <span className="min-w-0 flex-1 text-sm font-semibold">
                  {country.name_fr}{" "}
                  <span className="font-mono text-[11px] font-normal text-muted">{country.iso2}</span>
                </span>
                <select
                  name="tier"
                  key={country.tier}
                  defaultValue={country.tier}
                  aria-label={ta.scoring.countryTierLabel(country.name_fr)}
                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                  className="min-h-11 rounded-[12px] border border-line bg-card px-2 text-sm font-semibold"
                >
                  {COUNTRY_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {ta.scoring.tiers[tier]}
                      {tierPoints[`tier_${tier}`] !== undefined ? ` · ${tierPoints[`tier_${tier}`]} pts` : ""}
                    </option>
                  ))}
                </select>
              </form>
              {last?.iso2 === country.iso2 && <ActionMessage result={last.result} className="mt-1.5" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
