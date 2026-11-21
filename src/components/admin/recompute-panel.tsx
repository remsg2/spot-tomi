"use client";

import { useId, useState } from "react";
import { ta } from "@/i18n/admin.fr";
import type { ActionResult } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { parseSpotReference } from "@/lib/validation/admin";
import { ActionMessage } from "./action-message";
import { ConfirmAction } from "./confirm-action";
import { buttonGhost, buttonStrong, card, input, sectionTitle } from "./styles";
import { SubmitButton } from "./submit-button";

/** Recalcul explicite des points : un sticker (lien ou identifiant) ou tous. */
export function RecomputePanel({
  recomputeSpot,
  recomputeAll,
}: {
  recomputeSpot: (form: FormData) => Promise<ActionResult>;
  recomputeAll: (form: FormData) => Promise<ActionResult>;
}) {
  const ids = useId();
  const [one, setOne] = useState<ActionResult | null>(null);
  const [all, setAll] = useState<ActionResult | null>(null);

  async function submitOne(form: FormData) {
    if (!parseSpotReference(String(form.get("spotId") ?? ""))) {
      setOne({ ok: false, message: ta.scoring.recomputeInvalid });
      return;
    }
    setOne(await recomputeSpot(form));
  }

  return (
    <section aria-labelledby={`${ids}-title`} className={cn(card, "flex flex-col gap-3")}>
      <div className="flex flex-col gap-0.5">
        <h2 id={`${ids}-title`} className={sectionTitle}>
          {ta.scoring.recomputeTitle}
        </h2>
        <p className="text-xs text-muted">{ta.scoring.recomputeIntro}</p>
      </div>

      <form action={submitOne} className="flex flex-col gap-2">
        <label htmlFor={`${ids}-spot`} className="text-sm font-semibold">
          {ta.scoring.recomputeOne}
        </label>
        <div className="flex gap-2">
          <input
            id={`${ids}-spot`}
            name="spotId"
            placeholder={ta.scoring.recomputeOnePlaceholder}
            autoComplete="off"
            spellCheck={false}
            className={cn(input, "flex-1 font-mono text-sm")}
          />
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {ta.scoring.recomputeReason}
          <input name="reason" required minLength={3} maxLength={200} placeholder={ta.scoring.recomputeReasonPlaceholder} className={input} />
        </label>
        <SubmitButton className={cn(buttonGhost, "self-start")}>{ta.scoring.recomputeOneSubmit}</SubmitButton>
        <ActionMessage result={one} />
      </form>

      <form action={async (form) => setAll(await recomputeAll(form))} className="flex flex-wrap gap-2 border-t border-line pt-3">
        <label className="flex basis-full flex-col gap-1 text-xs font-semibold text-muted">
          {ta.scoring.recomputeReason}
          <input name="reason" required minLength={3} maxLength={200} placeholder={ta.scoring.recomputeReasonPlaceholder} className={input} />
        </label>
        <ConfirmAction
          trigger={ta.scoring.recomputeAll}
          question={ta.scoring.recomputeAllConfirm}
          confirmLabel={ta.scoring.recomputeAllYes}
          triggerClassName={buttonStrong}
          confirmClassName={buttonStrong}
        />
        <ActionMessage result={all} className="basis-full" />
      </form>
    </section>
  );
}
