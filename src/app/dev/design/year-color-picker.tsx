"use client";

import { useState } from "react";
import { contrastRatio, BAND_COLOR, isReadableYearColor, MIN_CONTRAST } from "@/lib/design/color";

const SWATCHES = ["#5DB043", "#5B8DEF", "#FF7A59", "#F2C230", "#9A9A94", "#1D4ED8"];

/**
 * Change --year sur <html> : tous les composants doivent se recolorer sans
 * autre modification (critère de l'étape 2). Aperçu du contrôle de contraste
 * qui bloquera une couleur illisible dans l'admin (étape 8).
 */
export function YearColorPicker() {
  const [color, setColor] = useState<string | null>(null);

  function apply(value: string) {
    setColor(value);
    document.documentElement.style.setProperty("--year", value);
  }

  const ratio = color ? contrastRatio(color, BAND_COLOR) : null;
  const readable = color ? isReadableYearColor(color) : true;

  return (
    <fieldset className="flex flex-wrap items-center gap-3">
      <legend className="sr-only">Couleur de l&apos;année (--year)</legend>
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          onClick={() => apply(swatch)}
          aria-label={`Appliquer ${swatch}`}
          aria-pressed={color === swatch}
          data-swatch={swatch}
          className="size-11 rounded-[10px] border border-line shadow-card aria-pressed:outline-3 aria-pressed:outline-offset-2 aria-pressed:outline-text"
          style={{ background: swatch }}
        />
      ))}
      <label className="flex min-h-11 items-center gap-2 rounded-[14px] border border-line bg-card px-3 text-sm font-semibold">
        Autre
        <input
          type="color"
          value={color ?? "#9a9a94"}
          onChange={(event) => apply(event.target.value)}
          className="size-7 cursor-pointer"
        />
      </label>
      {ratio !== null && (
        <span
          role="status"
          className={readable ? "text-sm text-muted" : "text-sm font-bold text-text"}
        >
          Contraste du texte noir : {ratio.toFixed(2)}:1
          {readable ? " · lisible" : ` · insuffisant (minimum ${MIN_CONTRAST}:1)`}
        </span>
      )}
    </fieldset>
  );
}
