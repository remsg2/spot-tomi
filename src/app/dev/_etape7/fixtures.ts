/*
 * Données simulées des pages /dev/classement et /dev/profil (développement
 * uniquement) : celles des maquettes Classement et Profil, en pseudos ASCII.
 * Elles alimentent les vrais composants pour les tests Playwright de mise en page.
 */
import { withRanks, type LeaderboardEntry, type Period } from "@/lib/leaderboard/leaderboard";
import type { AlbumRow, CountryTier } from "@/lib/profile/album";
import type { ProfileSpot } from "@/lib/profile/spots";
import type { ProfileData, ProfileIdentity } from "@/lib/profile/types";
import type { Badge, MemberStats, PassportStamp } from "@/lib/stats/queries";

export const DEV_YEAR = 2026;
/** Couleurs d'exemple : l'année en cours prend l'accent des maquettes. */
export const DEV_YEARS: Record<number, string> = {
  2023: "#F2C230",
  2024: "#FF7A59",
  2025: "#5B8DEF",
  2026: "#5DB043",
};
export const DEV_ACCENT = DEV_YEARS[DEV_YEAR];
export const ME_ID = "00000000-0000-4000-8000-00000000000a";
const LOW_ME_ID = "00000000-0000-4000-8000-0000000000ff";

type Totals = [username: string, points: number, countries: number, stickers: number];

const SEASON: Totals[] = [
  ["Lea", 1480, 9, 18],
  ["Remi", 1435, 11, 27],
  ["Hugo", 1315, 8, 20],
  ["Camille", 980, 6, 12],
  ["Nico", 760, 4, 15],
  ["Ines", 615, 5, 9],
  ["Paul", 540, 3, 11],
  ["Jade", 410, 3, 6],
];

const ALL_TIME: Totals[] = [
  ["Remi", 3120, 19, 61],
  ["Lea", 2985, 17, 44],
  ["Hugo", 2410, 14, 39],
  ["Camille", 1720, 11, 30],
  ["Nico", 1505, 9, 33],
  ["Ines", 1190, 9, 21],
  ["Paul", 990, 6, 25],
  ["Jade", 860, 6, 14],
  ["Sami", 640, 4, 12],
  ["Yuna", 610, 5, 9],
  ["Malo", 455, 3, 10],
  ["Zoe", 120, 1, 3],
];

function entries(rows: Totals[]): LeaderboardEntry[] {
  return withRanks(
    rows.map(([username, points, countries, stickers], index) => ({
      userId: username === "Remi" ? ME_ID : username === "Zoe" ? LOW_ME_ID : `00000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`,
      username,
      avatarUrl: null,
      points,
      countries,
      stickers,
    })),
  );
}

export type LeaderboardScenario = "moi" | "dehors" | "visiteur" | "vide" | "exaequo";

export function leaderboardFixture(period: Period, scenario: LeaderboardScenario) {
  if (scenario === "vide") return { entries: [], participants: 0, meId: ME_ID, limit: 50 };
  if (scenario === "dehors") {
    // L'utilisateur connecté (Zoe) est 12ᵉ : hors des 8 premières lignes.
    const all = entries(ALL_TIME);
    return { entries: all, participants: all.length, meId: LOW_ME_ID, limit: 8 };
  }
  if (scenario === "exaequo") {
    const tied = entries(SEASON.map(([u, p, c, s]) => [u, u === "Remi" ? 1480 : p, c, s] as Totals));
    return { entries: tied, participants: tied.length, meId: ME_ID, limit: 50 };
  }
  const list = entries(period === "all" ? ALL_TIME : SEASON);
  return { entries: list, participants: list.length, meId: scenario === "visiteur" ? null : ME_ID, limit: 50 };
}

// Profil -------------------------------------------------------------------------

// Points possibles par niveau de pays (country_potential_points) : base 100 + bonus du niveau.
const BASE: Record<CountryTier, number> = { courant: 100, lointain: 100, rare: 200, extreme: 300 };

function tile(iso3: string, nameFr: string, year: number, points: number, gold = false): AlbumRow {
  return {
    iso2: iso3.slice(0, 2),
    iso3,
    nameFr,
    tier: "lointain",
    conquered: true,
    firstYear: year,
    colorHex: DEV_YEARS[year] ?? "#9A9A94",
    points,
    stickers: 1,
    gold,
    suggestionRank: null,
  };
}

function suggestion(iso3: string, nameFr: string, tier: CountryTier, rank: number): AlbumRow {
  return {
    iso2: iso3.slice(0, 2),
    iso3,
    nameFr,
    tier,
    conquered: false,
    firstYear: null,
    colorHex: null,
    points: BASE[tier],
    stickers: 0,
    gold: false,
    suggestionRank: rank,
  };
}

const SUGGESTIONS: AlbumRow[] = [
  suggestion("NOR", "Norvège", "courant", 1),
  suggestion("DEU", "Allemagne", "courant", 2),
  suggestion("JPN", "Japon", "lointain", 1),
  suggestion("PER", "Pérou", "lointain", 2),
  suggestion("BTN", "Bhoutan", "rare", 1),
  suggestion("TKM", "Turkménistan", "rare", 2),
  suggestion("PRK", "Corée du Nord", "extreme", 1),
  suggestion("ATA", "Antarctique", "extreme", 2),
];

const ALBUM: AlbumRow[] = [
  tile("ARG", "Argentine", 2026, 195, true),
  tile("FRA", "France", 2023, 312),
  tile("MAR", "Maroc", 2024, 120, true),
  tile("ESP", "Espagne", 2024, 96),
  tile("ITA", "Italie", 2026, 85),
  tile("PRT", "Portugal", 2025, 70),
  tile("GBR", "Royaume-Uni", 2025, 64),
  tile("ISL", "Islande", 2025, 160, true),
  ...SUGGESTIONS,
];

let spotIndex = 0;
function spot(
  name: string,
  city: string | null,
  countryName: string,
  takenAt: string,
  points: number,
  extra: Partial<ProfileSpot> = {},
): ProfileSpot {
  spotIndex += 1;
  const year = Number(takenAt.slice(0, 4));
  return {
    id: `00000000-0000-4000-9000-${String(spotIndex).padStart(12, "0")}`,
    name,
    city,
    countryIso2: null,
    countryName,
    year,
    colorHex: DEV_YEARS[year] ?? "#9A9A94",
    status: "published",
    points,
    isFirstInCountry: false,
    isExceptional: false,
    takenAt,
    ...extra,
  };
}

const SPOTS: ProfileSpot[] = [
  spot("Fin du monde", "Ushuaïa", "Argentine", "2026-10-02T15:00:00Z", 195, { isFirstInCountry: true }),
  spot("Pont du Gard", "Vers-Pont-du-Gard", "France", "2026-08-14T09:30:00Z", 0, { status: "pending_review" }),
  spot("Colisée", "Rome", "Italie", "2026-04-20T11:00:00Z", 85, { isExceptional: true }),
  spot("Geysir", null, "Islande", "2025-07-09T18:00:00Z", 160, { isFirstInCountry: true }),
  spot("Belém", "Lisbonne", "Portugal", "2025-05-01T10:00:00Z", 70),
  spot("Abbey Road", "Londres", "Royaume-Uni", "2025-03-12T16:00:00Z", 64),
  spot("Arrêt de bus", "Londres", "Royaume-Uni", "2025-03-13T08:00:00Z", 2, { status: "hidden" }),
  spot("Médina", "Fès", "Maroc", "2024-09-21T12:00:00Z", 120, { isFirstInCountry: true }),
  spot("Sagrada Família", "Barcelone", "Espagne", "2024-06-30T14:00:00Z", 96),
  spot("Mont Blanc", "Chamonix", "France", "2023-08-03T07:00:00Z", 53),
];

/** Passeport simulé : un tampon par pays conquis de l'album. */
function passportFrom(rows: AlbumRow[]): PassportStamp[] {
  return rows
    .filter((row) => row.conquered && row.firstYear !== null)
    .map((row, index) => ({
      iso2: row.iso2,
      nameFr: row.nameFr,
      continent: null,
      continentLabel: null,
      firstSpotId: `00000000-0000-4000-8000-0000000002${String(index).padStart(2, "0")}`,
      firstPastedAt: `${row.firstYear}-06-${String(1 + (index % 27)).padStart(2, "0")}T12:00:00Z`,
      firstYear: row.firstYear as number,
      editionName: `Édition ${row.firstYear}`,
      color: row.colorHex ?? "#9A9A94",
      stickers: row.stickers,
      points: row.points,
      pioneer: row.gold,
    }));
}

const BADGES: Badge[] = [
  { code: "premier_tomi", name: "Premier Tomi", description: "Coller son premier sticker.", icon: "🐾", unlocked: true, unlockedAt: "2023-08-03T07:00:00Z", spotId: null, spotName: null },
  { code: "dix_tomis", name: "10 Tomis", description: "Coller 10 stickers.", icon: "🔟", unlocked: true, unlockedAt: "2024-09-21T12:00:00Z", spotId: null, spotName: null },
  { code: "dix_pays", name: "10 pays", description: "Faire voyager Tomi dans 10 pays.", icon: "🧭", unlocked: true, unlockedAt: "2025-07-09T18:00:00Z", spotId: null, spotName: null },
  { code: "cinq_continents", name: "5 continents", description: "Coller un sticker sur 5 continents.", icon: "🌍", unlocked: false, unlockedAt: null, spotId: null, spotName: null },
  { code: "altitude_3000", name: "Tomi des sommets", description: "Coller un sticker à plus de 3 000 m d'altitude.", icon: "🏔️", unlocked: true, unlockedAt: "2023-08-03T07:00:00Z", spotId: null, spotName: null },
  { code: "ile", name: "Tomi insulaire", description: "Coller un sticker sur une île.", icon: "🏝️", unlocked: true, unlockedAt: "2025-07-09T18:00:00Z", spotId: null, spotName: null },
];

const MEMBER: MemberStats = {
  stickers: 27,
  points: 1435,
  rank: 2,
  countries: 11,
  continents: [
    { code: "afrique", label: "Afrique" },
    { code: "europe", label: "Europe" },
  ],
  editions: [
    { year: 2026, name: "Édition 2026", colorHex: DEV_YEARS[2026], count: 9 },
    { year: 2025, name: "Édition 2025", colorHex: DEV_YEARS[2025], count: 10 },
    { year: 2024, name: "Édition 2024", colorHex: DEV_YEARS[2024], count: 6 },
  ],
  byCountry: [
    { iso2: "FR", nameFr: "France", count: 12 },
    { iso2: "IT", nameFr: "Italie", count: 4 },
  ],
  highest: { id: "00000000-0000-4000-8000-000000000301", name: "Mont Blanc", altitudeM: 4362 },
  mostIsolated: { id: "00000000-0000-4000-8000-000000000302", name: "Geysir", km: 412.5 },
  badges: 5,
  likesReceived: 14,
};

const PROGRESS = [
  { day: "2023-08-03", points: 300 },
  { day: "2024-06-30", points: 520 },
  { day: "2025-03-12", points: 890 },
  { day: "2025-07-09", points: 1160 },
  { day: "2026-04-20", points: 1435 },
];

export type ProfileScenario = "moi" | "autre" | "nouveau";

export function profileFixture(scenario: ProfileScenario): { identity: ProfileIdentity; data: ProfileData; isMe: boolean } {
  if (scenario === "nouveau") {
    return {
      isMe: true,
      identity: { userId: LOW_ME_ID, username: "Zoe", avatarUrl: null, sinceYear: DEV_YEAR, role: null },
      data: {
        stats: { points: 0, rank: null, stickers: 0, countries: 0, firsts: 0 },
        album: SUGGESTIONS,
        spots: [],
        passport: [],
        badges: BADGES.map((badge) => ({ ...badge, unlocked: false, unlockedAt: null })),
        member: { ...MEMBER, stickers: 0, points: 0, rank: null, countries: 0, continents: [], editions: [], byCountry: [], highest: null, mostIsolated: null, badges: 0, likesReceived: 0 },
        progress: [],
        countriesTotal: 237,
      },
    };
  }
  const isMe = scenario === "moi";
  return {
    isMe,
    identity: { userId: ME_ID, username: "Remi", avatarUrl: null, sinceYear: 2023, role: isMe ? "admin" : null },
    data: {
      stats: { points: 1435, rank: 2, stickers: 27, countries: 11, firsts: 3 },
      album: ALBUM,
      spots: isMe ? SPOTS : SPOTS.filter((s) => s.status === "published"),
      passport: passportFrom(ALBUM),
      badges: BADGES,
      member: MEMBER,
      progress: PROGRESS,
      countriesTotal: 237,
    },
  };
}
