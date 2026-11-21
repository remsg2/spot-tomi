/**
 * Classement : logique pure (sans Supabase ni React), testée par Vitest.
 * Les rangs viennent de la vue matérialisée `leaderboard` (règle des ex aequo :
 * 1, 1, 3) ; ce module trie, met en forme et compose podium et liste.
 */
import { leaderboardFr as l } from "@/i18n/leaderboard.fr";
import { formatPoints } from "@/lib/design/points";

export const CRITERIA = ["points", "countries", "stickers"] as const;
export type Criterion = (typeof CRITERIA)[number];

/** 'all' (depuis toujours) ou une année sur 4 chiffres. */
export type Period = "all" | `${number}`;

export type LeaderboardEntry = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  points: number;
  countries: number;
  stickers: number;
  rankPoints: number;
  rankCountries: number;
  rankStickers: number;
};

/** Nombre de lignes demandées en haut du classement. */
export const LEADERBOARD_LIMIT = 50;

// Paramètres d'URL ----------------------------------------------------------------

/** Valeurs d'URL lisibles : /leaderboard?periode=toujours&critere=pays */
const CRITERION_PARAM: Record<Criterion, string> = {
  points: "points",
  countries: "pays",
  stickers: "stickers",
};
const ALL_PARAM = "toujours";

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Période demandée : « toujours », une année, sinon l'année en cours. */
export function parsePeriod(value: SearchValue, currentYear: number): Period {
  const raw = first(value)?.trim().toLowerCase();
  if (raw === ALL_PARAM || raw === "all") return "all";
  if (raw && /^\d{4}$/.test(raw)) {
    const year = Number(raw);
    if (year >= 2000 && year <= 2100) return raw as Period;
  }
  return String(currentYear) as Period;
}

/** Critère demandé : points par défaut. */
export function parseCriterion(value: SearchValue): Criterion {
  const raw = first(value)?.trim().toLowerCase();
  const found = CRITERIA.find((c) => CRITERION_PARAM[c] === raw || c === raw);
  return found ?? "points";
}

/** Lien vers une vue du classement, sans les valeurs par défaut. */
export function leaderboardHref(
  { period, criterion }: { period: Period; criterion: Criterion },
  currentYear: number,
  basePath = "/leaderboard",
): string {
  const params = new URLSearchParams();
  if (period === "all") params.set("periode", ALL_PARAM);
  else if (period !== String(currentYear)) params.set("periode", period);
  if (criterion !== "points") params.set("critere", CRITERION_PARAM[criterion]);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// Tri et ex aequo -------------------------------------------------------------------

export function valueOf(entry: LeaderboardEntry, criterion: Criterion): number {
  return entry[criterion];
}

export function rankOf(entry: LeaderboardEntry, criterion: Criterion): number {
  if (criterion === "countries") return entry.rankCountries;
  if (criterion === "stickers") return entry.rankStickers;
  return entry.rankPoints;
}

function compareNames(a: LeaderboardEntry, b: LeaderboardEntry): number {
  const x = a.username.toLowerCase();
  const y = b.username.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
}

/** Ordre d'affichage : rang du critère, puis pseudo (comme get_leaderboard). */
export function sortEntries(entries: readonly LeaderboardEntry[], criterion: Criterion): LeaderboardEntry[] {
  return [...entries].sort((a, b) => rankOf(a, criterion) - rankOf(b, criterion) || compareNames(a, b));
}

/**
 * Rangs « sportifs » d'une liste de valeurs (la plus grande en tête) :
 * [30, 50, 50, 10] → [3, 1, 1, 4]. Même règle que rank() en SQL.
 */
export function competitionRanks(values: readonly number[]): number[] {
  return values.map((value) => 1 + values.filter((other) => other > value).length);
}

type RawTotals = Pick<LeaderboardEntry, "userId" | "username" | "avatarUrl" | "points" | "countries" | "stickers">;

/** Calcule les trois rangs d'une liste de totaux (données simulées, tests). */
export function withRanks(rows: readonly RawTotals[]): LeaderboardEntry[] {
  const rankPoints = competitionRanks(rows.map((r) => r.points));
  const rankCountries = competitionRanks(rows.map((r) => r.countries));
  const rankStickers = competitionRanks(rows.map((r) => r.stickers));
  return rows.map((row, i) => ({
    ...row,
    rankPoints: rankPoints[i],
    rankCountries: rankCountries[i],
    rankStickers: rankStickers[i],
  }));
}

/** Rang partagé avec quelqu'un d'autre ? */
export function isTied(entry: LeaderboardEntry, entries: readonly LeaderboardEntry[], criterion: Criterion): boolean {
  const rank = rankOf(entry, criterion);
  return entries.some((other) => other.userId !== entry.userId && rankOf(other, criterion) === rank);
}

// Mise en forme ------------------------------------------------------------------------

/** Valeur principale affichée à droite d'une ligne. */
export function formatValue(entry: LeaderboardEntry, criterion: Criterion): string {
  return criterion === "points" ? formatPoints(entry.points) : String(valueOf(entry, criterion));
}

/** Petite unité sous la valeur, sauf pour les points (comme les maquettes). */
export function valueUnit(entry: LeaderboardEntry, criterion: Criterion): string | null {
  if (criterion === "countries") return "pays";
  if (criterion === "stickers") return entry.stickers <= 1 ? "sticker" : "stickers";
  return null;
}

/** Valeur lue par un lecteur d'écran (« 1 435 points », « 6 pays »). */
export function spokenValue(entry: LeaderboardEntry, criterion: Criterion): string {
  if (criterion === "countries") return l.valueLabel.countries(entry.countries);
  if (criterion === "stickers") return l.valueLabel.stickers(entry.stickers);
  return l.valueLabel.points(formatPoints(entry.points));
}

/** Ligne secondaire : les deux autres critères (« 12 stickers · 6 pays »). */
export function entrySubline(entry: LeaderboardEntry, criterion: Criterion): string {
  const parts =
    criterion === "points"
      ? [l.stickers(entry.stickers), l.countries(entry.countries)]
      : criterion === "countries"
        ? [l.points(formatPoints(entry.points)), l.stickers(entry.stickers)]
        : [l.points(formatPoints(entry.points)), l.countries(entry.countries)];
  return parts.join(" · ");
}

/** Initiale de l'avatar de repli. */
export function initialOf(username: string): string {
  return (username.match(/[A-Za-z0-9]/)?.[0] ?? username[0] ?? "?").toUpperCase();
}

/** Couleurs des avatars sans photo : texte blanc lisible (contraste ≥ 4,5:1). */
export const AVATAR_COLORS = [
  "#7A4FD8",
  "#C2410C",
  "#0F766E",
  "#1D4ED8",
  "#BE185D",
  "#4D7C0F",
  "#6D28D9",
  "#111111",
] as const;

/** Couleur stable d'un utilisateur, d'après son identifiant. */
export function avatarColor(userId: string): string {
  let hash = 0;
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Composition du panneau ------------------------------------------------------------------

export type RankedRow = {
  entry: LeaderboardEntry;
  rank: number;
  isMe: boolean;
};

export type PodiumSlot = RankedRow & {
  /** Hauteur de la marche, d'après le rang (les ex aequo ont la même). */
  height: number;
  /** 1er : doré ; utilisateur connecté : couleur de l'année ; sinon neutre. */
  tone: "gold" | "me" | "plain";
};

export type LeaderboardView = {
  /** Haut du classement, dans l'ordre (liste complète en colonne web). */
  top: RankedRow[];
  /** Podium dans l'ordre visuel : 2ᵉ, 1er, 3ᵉ (null si la place est vide). */
  podium: Array<PodiumSlot | null>;
  /** Suite du classement sous le podium (mobile). */
  rest: RankedRow[];
  /** Ligne de l'utilisateur connecté s'il est hors du haut du classement. */
  meOutside: RankedRow | null;
  /** Utilisateur connecté sans aucun sticker publié sur la période. */
  meUnranked: boolean;
};

export const PODIUM_HEIGHTS = { 1: 128, 2: 96, 3: 76 } as const;

export function podiumHeight(rank: number): number {
  if (rank <= 1) return PODIUM_HEIGHTS[1];
  if (rank === 2) return PODIUM_HEIGHTS[2];
  return PODIUM_HEIGHTS[3];
}

/** Podium dans l'ordre des maquettes : 2ᵉ à gauche, 1er au centre, 3ᵉ à droite. */
export function podiumSlots(rows: readonly RankedRow[]): Array<PodiumSlot | null> {
  const slot = (row: RankedRow | undefined): PodiumSlot | null =>
    row
      ? {
          ...row,
          height: podiumHeight(row.rank),
          tone: row.rank === 1 ? "gold" : row.isMe ? "me" : "plain",
        }
      : null;
  return [slot(rows[1]), slot(rows[0]), slot(rows[2])];
}

/**
 * Compose le panneau : tri, podium (3 premiers), suite, et ligne de
 * l'utilisateur connecté mise en avant même hors du haut du classement.
 */
export function buildLeaderboardView(
  entries: readonly LeaderboardEntry[],
  criterion: Criterion,
  meId: string | null,
  limit = LEADERBOARD_LIMIT,
): LeaderboardView {
  const sorted = sortEntries(entries, criterion);
  const rows: RankedRow[] = sorted.map((entry) => ({
    entry,
    rank: rankOf(entry, criterion),
    isMe: meId !== null && entry.userId === meId,
  }));
  const top = rows.slice(0, limit);
  const meRow = rows.find((row) => row.isMe) ?? null;
  const meOutside = meRow && !top.includes(meRow) ? meRow : null;

  return {
    top,
    podium: top.length > 0 ? podiumSlots(top.slice(0, 3)) : [],
    rest: top.slice(3),
    meOutside,
    meUnranked: meId !== null && meRow === null,
  };
}
