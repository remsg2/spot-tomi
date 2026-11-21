import type { ActionResult } from "@/lib/admin/types";
import { cn } from "@/lib/cn";
import { messageError, messageOk } from "./styles";

/** Retour d'une Server Action, annoncé aux lecteurs d'écran. */
export function ActionMessage({ result, className }: { result: ActionResult | null; className?: string }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={cn(result.ok ? messageOk : messageError, className)}>
      {result.message}
    </p>
  );
}
