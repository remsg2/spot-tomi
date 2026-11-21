"use client";

import { useId, useState } from "react";
import { ta } from "@/i18n/admin.fr";
import { ruleLabel, type RuleGroup } from "@/lib/admin/rules";
import type { ActionResult, ScoringRule } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { parseRuleValue } from "@/lib/validation/admin";
import { ActionMessage } from "./action-message";
import { buttonGhost, card, input, smallTitle } from "./styles";
import { SubmitButton } from "./submit-button";

function RuleRow({ rule, action }: { rule: ScoringRule; action: (form: FormData) => Promise<ActionResult> }) {
  const id = useId();
  const [result, setResult] = useState<ActionResult | null>(null);

  async function submit(form: FormData) {
    const value = parseRuleValue(rule.key, String(form.get("value") ?? ""));
    if (!value.ok) {
      setResult({ ok: false, message: value.error });
      return;
    }
    setResult(await action(form));
  }

  return (
    <li className="border-b border-line py-2 last:border-b-0">
      <form action={submit} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="key" value={rule.key} />
        <label htmlFor={id} className="min-w-0 flex-1 text-sm font-semibold">
          {ruleLabel(rule.key)}
          <span className="block font-mono text-[11px] font-normal text-muted">{rule.key}</span>
        </label>
        <input
          id={id}
          name="value"
          inputMode="decimal"
          defaultValue={String(rule.value).replace(".", ",")}
          key={rule.value}
          aria-invalid={result && !result.ok ? true : undefined}
          className={cn(input, "w-24 text-right font-bold")}
        />
        <SubmitButton className={buttonGhost}>{ta.save}</SubmitButton>
      </form>
      <ActionMessage result={result} className="mt-2" />
    </li>
  );
}

/** Bonus, malus et points de base : une ligne par règle de scoring_rules. */
export function RuleForms({
  groups,
  action,
}: {
  groups: Array<{ group: RuleGroup; rules: ScoringRule[] }>;
  action: (form: FormData) => Promise<ActionResult>;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {groups.map(({ group, rules }) => (
        <section key={group} aria-labelledby={`rules-${group}`} className={card}>
          <h3 id={`rules-${group}`} className={smallTitle}>
            {ta.scoring.groups[group]}
          </h3>
          <ul>
            {rules.map((rule) => (
              <RuleRow key={rule.key} rule={rule} action={action} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
