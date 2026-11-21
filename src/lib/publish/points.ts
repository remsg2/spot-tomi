import type { PointLine } from "@/components/ui";
import { toPointLines as rowsToPointLines } from "@/lib/points/lines";
import type { PointRuleKey } from "@/lib/types/database";
import type { PublishedPointLine } from "./contract";

/**
 * Lignes du contrat publish-spot (ou de l'estimation) → lignes du design
 * system, avec l'adaptateur de l'étape 4 (base sans « + », puces dorées).
 * Les lignes arrivent déjà dans l'ordre d'affichage.
 */
export function toPointLines(lines: readonly PublishedPointLine[]): PointLine[] {
  return rowsToPointLines(
    lines.map((line, index) => ({
      spot_id: "",
      rule_key: line.ruleKey as PointRuleKey,
      position: index + 1,
      label: line.label,
      detail: line.detail,
      points: line.points,
    })),
  );
}
