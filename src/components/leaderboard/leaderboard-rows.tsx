import Link from "next/link";
import { leaderboardFr as l } from "@/i18n/leaderboard.fr";
import { cn } from "@/lib/cn";
import {
  entrySubline,
  formatValue,
  spokenValue,
  valueUnit,
  type Criterion,
  type PodiumSlot,
  type RankedRow,
} from "@/lib/leaderboard/leaderboard";
import { UserAvatar } from "@/components/profile/user-avatar";

/** Profil d'un participant : /me pour soi, /u/pseudo pour les autres. */
export function profileHref(row: RankedRow): string {
  return row.isMe ? "/me" : `/u/${encodeURIComponent(row.entry.username)}`;
}

function displayName(row: RankedRow): string {
  return row.isMe ? l.you(row.entry.username) : row.entry.username;
}

function rowLabel(row: RankedRow, criterion: Criterion): string {
  return `${l.rowLabel(row.rank, row.entry.username, spokenValue(row.entry, criterion), row.isMe)}, ${entrySubline(row.entry, criterion)}`;
}

/** Bord de l'anneau : la couleur du fond sous le podium (--edge, sinon --bg). */
const EDGE = "var(--edge, var(--bg))";

const PODIUM_RING: Record<PodiumSlot["tone"], string> = {
  gold: `0 0 0 3px ${EDGE}, 0 0 0 6px var(--gold), 0 0 16px rgb(233 181 47 / 0.6)`,
  me: `0 0 0 3px ${EDGE}, 0 0 0 6px var(--year)`,
  plain: `0 0 0 3px ${EDGE}`,
};

const PODIUM_RANK_COLOR: Record<PodiumSlot["tone"], string> = {
  gold: "var(--gold)",
  me: "var(--year)",
  plain: "#FFFFFF",
};

/** Place dans la grille : 2ᵉ à gauche, 1er au centre, 3ᵉ à droite (ordre du DOM : 1, 2, 3). */
const PODIUM_COLUMN = ["col-start-2", "col-start-1", "col-start-3"] as const;

/** Podium des trois premiers (maquette Classement). */
export function Podium({
  slots,
  criterion,
  className,
}: {
  /** Ordre visuel [2ᵉ, 1er, 3ᵉ], comme podiumSlots(). */
  slots: Array<PodiumSlot | null>;
  criterion: Criterion;
  className?: string;
}) {
  // Ordre logique pour les lecteurs d'écran : 1er, 2ᵉ, 3ᵉ.
  const ordered = [slots[1], slots[0], slots[2]];
  return (
    <ol aria-label={l.podiumLabel} className={cn("grid grid-cols-3 items-end gap-2 pt-1.5", className)}>
      {ordered.map((slot, index) =>
        slot ? (
          <li key={slot.entry.userId} data-podium-rank={slot.rank} className={cn("row-start-1 min-w-0", PODIUM_COLUMN[index])}>
            <Link
              href={profileHref(slot)}
              aria-label={rowLabel(slot, criterion)}
              className="flex flex-col items-center gap-1.5 rounded-t-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text"
            >
              <UserAvatar
                userId={slot.entry.userId}
                username={slot.entry.username}
                avatarUrl={slot.entry.avatarUrl}
                ring={PODIUM_RING[slot.tone]}
                px={54}
                className="size-[54px] font-display text-xl"
              />
              <span className="flex max-w-full min-w-0 flex-col items-center">
                <span className="max-w-full truncate text-sm font-bold">{displayName(slot)}</span>
                <span className="font-display text-[15px]">
                  {formatValue(slot.entry, criterion)}
                  {valueUnit(slot.entry, criterion) && (
                    <span className="ml-1 font-sans text-[11px] font-semibold text-muted">
                      {valueUnit(slot.entry, criterion)}
                    </span>
                  )}
                </span>
              </span>
              <span
                data-podium-step=""
                className="flex w-full items-center justify-center rounded-t bg-band [clip-path:polygon(0_18%,100%_0,100%_100%,0_100%)]"
                style={{ height: slot.height }}
              >
                <span className="pt-2.5 font-display text-[34px] leading-none" style={{ color: PODIUM_RANK_COLOR[slot.tone] }}>
                  {slot.rank}
                </span>
              </span>
            </Link>
          </li>
        ) : null,
      )}
    </ol>
  );
}

/**
 * Ligne du classement. L'utilisateur connecté est mis en avant (fond couleur
 * de l'année, maquette Web sombre) ; le 1er a un anneau doré.
 */
export function LeaderboardRow({
  row,
  criterion,
  className,
}: {
  row: RankedRow;
  criterion: Criterion;
  className?: string;
}) {
  const { entry, rank, isMe } = row;
  const first = rank === 1;
  const unit = valueUnit(entry, criterion);
  return (
    <Link
      href={profileHref(row)}
      aria-label={rowLabel(row, criterion)}
      aria-current={isMe ? "true" : undefined}
      data-me={isMe ? "" : undefined}
      className={cn(
        "flex h-[58px] items-center gap-3 rounded-2xl border px-3.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-text lg:h-[62px]",
        isMe ? "border-year bg-year text-on-year" : "border-line bg-card text-text",
        className,
      )}
    >
      <span
        className={cn(
          "w-5 shrink-0 font-display text-[15px] lg:w-[22px] lg:text-[17px]",
          isMe ? "text-on-year" : first ? "text-[#8F6A0A] dark:text-[#B98A12]" : "text-muted",
        )}
      >
        {rank}
      </span>
      <UserAvatar
        userId={entry.userId}
        username={entry.username}
        avatarUrl={entry.avatarUrl}
        ring={first ? "0 0 0 2px var(--gold)" : isMe ? "0 0 0 2px #FFFFFF" : undefined}
        px={38}
        className="size-9 text-sm font-extrabold lg:size-[38px]"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{displayName(row)}</span>
        <span className={cn("truncate text-xs", isMe ? "opacity-75" : "text-muted")}>
          {entrySubline(entry, criterion)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end leading-none">
        <span className="font-display text-[17px] lg:text-lg">{formatValue(entry, criterion)}</span>
        {unit && <span className={cn("mt-0.5 text-[11px] font-semibold", isMe ? "opacity-75" : "text-muted")}>{unit}</span>}
      </span>
    </Link>
  );
}
