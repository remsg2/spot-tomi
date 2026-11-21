import { PrimaryLink, Sticker } from "@/components/ui";
import { leaderboardFr as l } from "@/i18n/leaderboard.fr";
import { cn } from "@/lib/cn";
import {
  buildLeaderboardView,
  LEADERBOARD_LIMIT,
  type Criterion,
  type LeaderboardEntry,
  type Period,
} from "@/lib/leaderboard/leaderboard";
import { CriterionChips, PeriodToggle } from "./leaderboard-controls";
import { LeaderboardRow, Podium } from "./leaderboard-rows";

/**
 * Disposition :
 * - « podium » : maquette Classement (mobile, plein écran) ;
 * - « list » : maquette Web sombre (colonne de 440 px) : titre avec la période,
 *   nombre de participants, liste complète sans podium ;
 * - « auto » (défaut) : podium sous 1024 px, liste à partir de 1024 px.
 */
export type LeaderboardVariant = "auto" | "podium" | "list";

const ONLY_PODIUM = { auto: "lg:hidden", podium: "", list: "hidden" } as const;
const ONLY_LIST_FLEX = { auto: "hidden lg:flex", podium: "hidden", list: "flex" } as const;
const ONLY_LIST_INLINE = { auto: "hidden lg:inline", podium: "hidden", list: "inline" } as const;
const ONLY_PODIUM_INLINE = { auto: "lg:hidden", podium: "", list: "hidden" } as const;
const ONLY_LIST_BLOCK = { auto: "hidden lg:block", podium: "hidden", list: "block" } as const;
/** La liste remonte de 6 px sous le podium (maquette), pas en colonne web. */
const LIST_OFFSET = { auto: "-mt-1.5 lg:mt-0", podium: "-mt-1.5", list: "" } as const;

export type LeaderboardPanelProps = {
  entries: readonly LeaderboardEntry[];
  participants: number;
  period: Period;
  criterion: Criterion;
  /** Année de la saison en cours (période par défaut). */
  currentYear: number;
  /** Utilisateur connecté, mis en avant ; null pour un visiteur. */
  meId: string | null;
  /** Nombre de lignes du haut du classement (celui demandé à la base). */
  limit?: number;
  variant?: LeaderboardVariant;
  /** Chemin des liens de période et de critère. */
  basePath?: string;
  className?: string;
};

/**
 * Panneau du classement, réutilisable : plein écran sur mobile ou dans la
 * colonne de 440 px du gabarit web (étape 6). Composant serveur, sans état :
 * la période et le critère sont dans l'URL.
 */
export function LeaderboardPanel({
  entries,
  participants,
  period,
  criterion,
  currentYear,
  meId,
  limit = LEADERBOARD_LIMIT,
  variant = "auto",
  basePath = "/leaderboard",
  className,
}: LeaderboardPanelProps) {
  const view = buildLeaderboardView(entries, criterion, meId, limit);
  const controls = { period, criterion, currentYear, basePath };
  const isEmpty = view.top.length === 0;

  return (
    <section
      aria-labelledby="leaderboard-title"
      data-variant={variant}
      className={cn("flex flex-col gap-3.5", className)}
    >
      <header className="flex flex-col gap-3.5 lg:gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 id="leaderboard-title" className="font-display text-[28px] leading-tight font-normal lg:text-2xl">
            <span className={ONLY_PODIUM_INLINE[variant]}>{l.title}</span>
            <span className={ONLY_LIST_INLINE[variant]}>{l.titleFor(period === "all" ? null : period)}</span>
          </h1>
          <PeriodToggle {...controls} className={ONLY_PODIUM[variant]} />
          <span className={cn("shrink-0 text-xs text-muted", ONLY_LIST_BLOCK[variant])}>
            {l.participants(participants)}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CriterionChips {...controls} />
          <PeriodToggle {...controls} className={ONLY_LIST_FLEX[variant]} />
        </div>
      </header>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 rounded-[20px] border border-line bg-card px-5 py-8 text-center">
          <Sticker size={84} tilt={-5} />
          <p className="text-sm text-muted">{l.empty}</p>
          <PrimaryLink href="/spots/new">{l.emptyCta}</PrimaryLink>
        </div>
      ) : (
        <>
          <Podium slots={view.podium} criterion={criterion} className={ONLY_PODIUM[variant]} />
          <ol aria-label={l.listLabel} className={cn("flex flex-col gap-2", LIST_OFFSET[variant])}>
            {view.top.map((row, index) => (
              <li
                key={row.entry.userId}
                // Les 3 premiers sont sur le podium tant qu'il est affiché.
                className={index < 3 ? cn("flex-col", ONLY_LIST_FLEX[variant]) : "flex flex-col"}
              >
                <LeaderboardRow row={row} criterion={criterion} />
              </li>
            ))}
          </ol>
          {view.meOutside && (
            <div className="flex flex-col gap-2">
              <span aria-hidden="true" className="text-center font-display text-lg leading-none text-muted">
                ⋯
              </span>
              <ol aria-label={l.myRow} className="flex flex-col">
                <li className="flex flex-col">
                  <LeaderboardRow row={view.meOutside} criterion={criterion} />
                </li>
              </ol>
              <span className="sr-only">{l.gap}</span>
            </div>
          )}
        </>
      )}

      {view.meUnranked && !isEmpty && (
        <p className="rounded-2xl border border-dashed border-dash px-4 py-3 text-sm text-muted">
          {l.notRanked}
        </p>
      )}
    </section>
  );
}

/** Squelette affiché pendant le chargement (même encombrement que le panneau). */
export function LeaderboardSkeleton() {
  return (
    <div role="status" aria-label={l.loading} className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className="h-8 w-40 rounded-lg bg-soft" />
        <span className="h-10 w-36 rounded-xl bg-soft" />
      </div>
      <div className="flex gap-2">
        <span className="h-[34px] w-20 rounded-full bg-soft" />
        <span className="h-[34px] w-16 rounded-full bg-soft" />
        <span className="h-[34px] w-24 rounded-full bg-soft" />
      </div>
      <div className="grid grid-cols-3 items-end gap-2 pt-1.5 lg:hidden">
        <span className="h-[170px] rounded-t bg-soft" />
        <span className="h-[202px] rounded-t bg-soft" />
        <span className="h-[150px] rounded-t bg-soft" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className="h-[58px] rounded-2xl bg-soft lg:h-[62px]" />
      ))}
    </div>
  );
}
