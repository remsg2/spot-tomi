"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { t } from "@/i18n/fr";
import { THEMES } from "./theme-provider";

const subscribe = () => () => {};

/** Choix du thème : système, clair ou sombre (réglages du profil). */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // Le thème enregistré n'est connu qu'après l'hydratation.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? (theme ?? "system") : null;

  return (
    <div
      role="radiogroup"
      aria-label={t.theme.label}
      className="inline-flex rounded-[14px] bg-soft p-[3px]"
    >
      {THEMES.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          onClick={() => setTheme(value)}
          className="min-h-11 rounded-[11px] px-4 text-[13px] font-semibold text-muted aria-checked:bg-card aria-checked:font-bold aria-checked:text-text aria-checked:shadow-sm"
        >
          {t.theme[value]}
        </button>
      ))}
    </div>
  );
}
