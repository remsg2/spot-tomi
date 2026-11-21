import type { ReactNode } from "react";
import { Sticker } from "@/components/ui";
import { ta } from "@/i18n/admin.fr";
import { t } from "@/i18n/fr";

/**
 * Aperçu en direct de la couleur choisie (maquette Admin) : sticker, bouton
 * principal et bloc de points. La couleur est passée en prop : l'app ne change
 * pas de couleur tant que l'admin n'a pas appliqué.
 */
export function SeasonPreview({ color, year, note }: { color: string; year: number; note: ReactNode }) {
  return (
    <div className="flex items-center gap-4" data-season-preview={color}>
      <Sticker size={128} tilt={-4} color={color} band={String(year)} label={ta.season.previewSticker(year)} />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div
          aria-hidden="true"
          data-preview="button"
          className="relative flex h-11 items-center overflow-hidden rounded-[12px] px-3 font-display text-[13px] text-on-year"
          style={{ background: color }}
        >
          <span className="relative truncate">{ta.season.previewButton}</span>
          <span className="absolute inset-0 bg-band [clip-path:polygon(70%_100%,100%_10%,100%_100%)]" />
        </div>
        <div
          aria-hidden="true"
          data-preview="points"
          className="relative flex h-11 items-center justify-end gap-1 overflow-hidden rounded-[12px] bg-band px-3"
          style={{ color }}
        >
          <span className="font-display text-[22px] leading-none">{ta.season.previewPoints}</span>
          <span className="text-[11px] font-bold">{t.points.unit}</span>
        </div>
        {note}
      </div>
    </div>
  );
}
