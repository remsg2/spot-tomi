"use client";

import { useEffect, useRef } from "react";
import { PrimaryButton } from "@/components/ui";
import { tp, type PublishErrorKey } from "@/i18n/publish.fr";
import { cn } from "@/lib/cn";
import { FlowHeader } from "./flow-header";
import { AlertIcon, CheckIcon, Spinner } from "./icons";

export type PublishPhase = "encode" | "upload" | "score";
const PHASES: PublishPhase[] = ["encode", "upload", "score"];

/** Étape 3 / 3 : nettoyage et envoi de la photo, puis calcul des points par le serveur. */
export function PublishingStep({
  previewUrl,
  phase,
  error,
  serverMessage,
  onRetry,
  onBack,
}: {
  previewUrl: string;
  phase: PublishPhase;
  error: PublishErrorKey | null;
  serverMessage?: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = PHASES.indexOf(phase);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col gap-3.5 px-4 pt-4 pb-8 lg:pt-10">
      <FlowHeader step={3} />
      <div className="relative h-[200px] shrink-0 overflow-hidden rounded-[20px] bg-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt="" className="size-full object-cover" />
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-normal outline-none">
        {tp.publishing.title}
      </h2>

      <ol className="flex flex-col rounded-[20px] border border-line bg-card px-3.5 py-1.5" aria-live="polite">
        {PHASES.map((name, index) => {
          const done = index < current;
          const active = index === current;
          const failed = active && error !== null;
          return (
            <li
              key={name}
              aria-current={active ? "step" : undefined}
              className="flex min-h-11 items-center gap-3 border-b border-line py-2 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-[26px] shrink-0 items-center justify-center rounded-[8px]",
                  done ? "bg-year text-on-year" : "bg-soft text-text",
                )}
              >
                {done ? <CheckIcon size={16} /> : failed ? <AlertIcon size={15} /> : active ? <Spinner size={15} /> : null}
              </span>
              <span className={cn("text-sm", active || done ? "font-semibold" : "text-muted")}>
                {tp.publishing[name]}
              </span>
            </li>
          );
        })}
      </ol>

      {error && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="flex items-start gap-2.5 rounded-[14px] border border-line bg-card p-3 text-sm font-semibold">
            <AlertIcon size={18} className="mt-px shrink-0" />
            <span>
              {tp.errors[error]}
              {serverMessage && error === "invalid_input" && (
                <span className="mt-1 block text-xs font-medium text-muted">{serverMessage}</span>
              )}
            </span>
          </p>
          <PrimaryButton fullWidth onClick={onRetry}>
            {tp.publishing.retry}
          </PrimaryButton>
          <button
            type="button"
            onClick={onBack}
            className="min-h-12 rounded-[14px] border border-line bg-card px-4 text-[15px] font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
          >
            {tp.publishing.back}
          </button>
        </div>
      )}
    </div>
  );
}
