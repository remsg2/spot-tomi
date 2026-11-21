import type { CSSProperties } from "react";
import { t } from "@/i18n/fr";
import { tp, type PublishErrorKey } from "@/i18n/publish.fr";
import { formatPoints } from "@/lib/design/points";
import type { Estimate } from "@/lib/publish/contract";
import { Spinner } from "./icons";

export type EstimateState =
  | { kind: "waiting" }
  | { kind: "loading"; previous: Estimate | null }
  | { kind: "ready"; data: Estimate }
  | { kind: "error"; code: PublishErrorKey };

/** Bloc noir « Estimation » de la maquette : badge et total approché, couleur de l'année de la photo. */
export function EstimatePanel({ state, pending }: { state: EstimateState; pending: boolean }) {
  const data = state.kind === "ready" ? state.data : state.kind === "loading" ? state.previous : null;
  const accent = data?.colorHex;

  return (
    <div
      aria-live="polite"
      aria-busy={state.kind === "loading"}
      className="relative flex min-h-[72px] shrink-0 items-center justify-between gap-3 overflow-hidden rounded-[18px] bg-panel px-4 py-3 text-white"
      style={accent ? ({ "--year": accent } as CSSProperties) : undefined}
      data-testid="estimate"
    >
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="text-xs font-semibold text-[#BDBCB6]">{tp.review.estimate}</span>
        {data?.isFirstInCountry && (
          <span className="rounded-[6px] bg-gold px-[7px] py-[3px] text-[11px] font-bold text-[#111111]">
            {tp.review.firstInCountry}
          </span>
        )}
        {pending && data && (
          <span className="rounded-[6px] bg-[#3A3A40] px-[7px] py-[3px] text-[11px] font-bold text-white">
            {tp.review.estimatePending}
          </span>
        )}
        {state.kind === "waiting" && <span className="text-[13px] font-semibold">{tp.review.estimateWaiting}</span>}
        {state.kind === "error" && <span className="text-[13px] font-semibold">{tp.review.estimateUnavailable}</span>}
      </div>

      {data ? (
        <div className="flex shrink-0 items-baseline gap-[5px] text-year">
          <span className="sr-only">{tp.review.estimateLabel(formatPoints(data.pointsTotal))}</span>
          <span aria-hidden="true" className="text-lg font-bold">
            {tp.review.approx}
          </span>
          <span aria-hidden="true" className="font-display text-[38px] leading-none">
            {formatPoints(data.pointsTotal)}
          </span>
          <span aria-hidden="true" className="text-[13px] font-bold">
            {t.points.unit}
          </span>
        </div>
      ) : (
        state.kind === "loading" && (
          <span className="flex items-center gap-2 text-[13px] font-semibold text-[#BDBCB6]">
            <Spinner />
            {tp.review.estimateLoading}
          </span>
        )
      )}
    </div>
  );
}
