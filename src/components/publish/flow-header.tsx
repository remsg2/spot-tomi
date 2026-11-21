import Link from "next/link";
import { tp } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./icons";

export const FLOW_STEPS = 3;

/** En-tête du parcours (maquette « Ajout d'un sticker ») : fermer, titre, étape et barre de progression. */
export function FlowHeader({ step, className }: { step: 1 | 2 | 3; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      <div className="flex items-center justify-between">
        <Link
          href="/"
          aria-label={tp.close}
          className="flex size-11 items-center justify-center rounded-full border border-line bg-card text-text focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
        >
          <CloseIcon />
        </Link>
        <h1 className="font-display text-xl font-normal">{tp.title}</h1>
        <span className="w-11 text-right text-[13px] font-bold text-muted" aria-hidden="true">
          {tp.stepCount(step, FLOW_STEPS)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={tp.progress(step, FLOW_STEPS)}
        aria-valuemin={1}
        aria-valuemax={FLOW_STEPS}
        aria-valuenow={step}
        className="grid grid-cols-3 gap-1.5"
      >
        {Array.from({ length: FLOW_STEPS }, (_, index) => (
          <span key={index} className={cn("h-[5px] rounded-[3px]", index < step ? "bg-year" : "bg-line")} />
        ))}
      </div>
    </div>
  );
}
