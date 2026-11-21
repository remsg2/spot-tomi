import { describe, expect, it } from "vitest";
import {
  avatarColor,
  AVATAR_COLORS,
  buildLeaderboardView,
  competitionRanks,
  entrySubline,
  formatValue,
  initialOf,
  isTied,
  leaderboardHref,
  parseCriterion,
  parsePeriod,
  podiumHeight,
  podiumSlots,
  sortEntries,
  spokenValue,
  valueUnit,
  withRanks,
  type LeaderboardEntry,
} from "./leaderboard";
import { toEntry } from "./mappers";
import { ordinalFr } from "@/i18n/leaderboard.fr";

const nbsp = (s: string) => s.replace(/\s/g, " ");

function people(): LeaderboardEntry[] {
  return withRanks([
    { userId: "u-hugo", username: "Hugo", avatarUrl: null, points: 1315, countries: 8, stickers: 20 },
    { userId: "u-lea", username: "Lea", avatarUrl: null, points: 1480, countries: 9, stickers: 18 },
    { userId: "u-remi", username: "Remi", avatarUrl: null, points: 1435, countries: 11, stickers: 27 },
    { userId: "u-cam", username: "camille", avatarUrl: null, points: 980, countries: 6, stickers: 12 },
    { userId: "u-nico", username: "Nico", avatarUrl: null, points: 980, countries: 4, stickers: 15 },
  ]);
}

describe("paramètres d'URL", () => {
  it("année en cours par défaut, « toujours » ou une année explicite", () => {
    expect(parsePeriod(undefined, 2026)).toBe("2026");
    expect(parsePeriod("toujours", 2026)).toBe("all");
    expect(parsePeriod("Toujours", 2026)).toBe("all");
    expect(parsePeriod("2025", 2026)).toBe("2025");
    expect(parsePeriod(["toujours", "2025"], 2026)).toBe("all");
  });

  it("ignore une période invalide", () => {
    expect(parsePeriod("hier", 2026)).toBe("2026");
    expect(parsePeriod("1850", 2026)).toBe("2026");
    expect(parsePeriod("20255", 2026)).toBe("2026");
  });

  it("points par défaut, pays et stickers en français", () => {
    expect(parseCriterion(undefined)).toBe("points");
    expect(parseCriterion("pays")).toBe("countries");
    expect(parseCriterion("stickers")).toBe("stickers");
    expect(parseCriterion("likes")).toBe("points");
  });

  it("construit des liens sans les valeurs par défaut", () => {
    expect(leaderboardHref({ period: "2026", criterion: "points" }, 2026)).toBe("/leaderboard");
    expect(leaderboardHref({ period: "all", criterion: "points" }, 2026)).toBe("/leaderboard?periode=toujours");
    expect(leaderboardHref({ period: "2026", criterion: "countries" }, 2026)).toBe("/leaderboard?critere=pays");
    expect(leaderboardHref({ period: "2025", criterion: "stickers" }, 2026, "/dev/classement")).toBe(
      "/dev/classement?periode=2025&critere=stickers",
    );
  });

  it("aller-retour URL → paramètres", () => {
    const href = leaderboardHref({ period: "all", criterion: "countries" }, 2026);
    const params = new URL(href, "http://x").searchParams;
    expect(parsePeriod(params.get("periode") ?? undefined, 2026)).toBe("all");
    expect(parseCriterion(params.get("critere") ?? undefined)).toBe("countries");
  });
});

describe("ex aequo", () => {
  it("rangs sportifs : égalité au même rang, le suivant saute", () => {
    expect(competitionRanks([30, 50, 50, 10])).toEqual([3, 1, 1, 4]);
    expect(competitionRanks([7, 7, 7])).toEqual([1, 1, 1]);
    expect(competitionRanks([])).toEqual([]);
  });

  it("calcule les trois rangs indépendamment", () => {
    const byName = Object.fromEntries(people().map((e) => [e.username, e]));
    expect(byName.Lea.rankPoints).toBe(1);
    expect(byName.camille.rankPoints).toBe(4);
    expect(byName.Nico.rankPoints).toBe(4);
    expect(byName.Remi.rankCountries).toBe(1);
    expect(byName.Remi.rankStickers).toBe(1);
  });

  it("détecte une égalité", () => {
    const entries = people();
    const camille = entries.find((e) => e.username === "camille")!;
    const lea = entries.find((e) => e.username === "Lea")!;
    expect(isTied(camille, entries, "points")).toBe(true);
    expect(isTied(lea, entries, "points")).toBe(false);
  });
});

describe("tri", () => {
  it("par rang du critère, puis par pseudo sans casse", () => {
    expect(sortEntries(people(), "points").map((e) => e.username)).toEqual([
      "Lea",
      "Remi",
      "Hugo",
      "camille",
      "Nico",
    ]);
    expect(sortEntries(people(), "countries").map((e) => e.username)).toEqual([
      "Remi",
      "Lea",
      "Hugo",
      "camille",
      "Nico",
    ]);
    expect(sortEntries(people(), "stickers")[0].username).toBe("Remi");
  });

  it("ne modifie pas la liste reçue", () => {
    const entries = people();
    const before = entries.map((e) => e.userId);
    sortEntries(entries, "points");
    expect(entries.map((e) => e.userId)).toEqual(before);
  });
});

describe("mise en forme", () => {
  const remi = people().find((e) => e.username === "Remi")!;

  it("valeur principale et unité selon le critère", () => {
    expect(nbsp(formatValue(remi, "points"))).toBe("1 435");
    expect(valueUnit(remi, "points")).toBeNull();
    expect(formatValue(remi, "countries")).toBe("11");
    expect(valueUnit(remi, "countries")).toBe("pays");
    expect(valueUnit({ ...remi, stickers: 1 }, "stickers")).toBe("sticker");
  });

  it("ligne secondaire : les deux autres critères", () => {
    expect(entrySubline(remi, "points")).toBe("27 stickers · 11 pays");
    expect(nbsp(entrySubline(remi, "countries"))).toBe("1 435 pts · 27 stickers");
    expect(nbsp(entrySubline(remi, "stickers"))).toBe("1 435 pts · 11 pays");
    expect(entrySubline({ ...remi, stickers: 1, countries: 1 }, "points")).toBe("1 sticker · 1 pays");
  });

  it("lecture d'écran et ordinaux français", () => {
    expect(nbsp(spokenValue(remi, "points"))).toBe("1 435 points");
    expect(spokenValue(remi, "countries")).toBe("11 pays");
    expect(ordinalFr(1)).toBe("1er");
    expect(ordinalFr(2)).toBe("2ᵉ");
  });

  it("initiale et couleur d'avatar stables", () => {
    expect(initialOf("remi")).toBe("R");
    expect(initialOf("_tomi")).toBe("T");
    expect(avatarColor("u-remi")).toBe(avatarColor("u-remi"));
    expect(AVATAR_COLORS).toContain(avatarColor("n'importe quoi"));
  });
});

describe("podium et panneau", () => {
  it("hauteur des marches selon le rang", () => {
    expect([1, 2, 3, 4].map(podiumHeight)).toEqual([128, 96, 76, 76]);
  });

  it("ordre visuel 2ᵉ, 1er, 3ᵉ et tons", () => {
    const view = buildLeaderboardView(people(), "points", "u-remi");
    const [left, center, right] = view.podium;
    expect(center?.entry.username).toBe("Lea");
    expect(center?.tone).toBe("gold");
    expect(left?.entry.username).toBe("Remi");
    expect(left?.tone).toBe("me");
    expect(right?.entry.username).toBe("Hugo");
    expect(right?.tone).toBe("plain");
    expect(view.rest.map((r) => r.entry.username)).toEqual(["camille", "Nico"]);
    expect(view.rest.map((r) => r.rank)).toEqual([4, 4]);
  });

  it("ex aequo au sommet : deux marches de premier", () => {
    const entries = withRanks([
      { userId: "a", username: "a", avatarUrl: null, points: 50, countries: 1, stickers: 1 },
      { userId: "b", username: "b", avatarUrl: null, points: 50, countries: 1, stickers: 1 },
      { userId: "c", username: "c", avatarUrl: null, points: 10, countries: 1, stickers: 1 },
    ]);
    const slots = buildLeaderboardView(entries, "points", null).podium;
    expect(slots.map((s) => s?.rank)).toEqual([1, 1, 3]);
    expect(slots.map((s) => s?.height)).toEqual([128, 128, 76]);
  });

  it("places vides si moins de trois participants", () => {
    const one = buildLeaderboardView(people().slice(0, 1), "points", null);
    expect(one.podium[0]).toBeNull();
    expect(one.podium[1]?.entry.username).toBe("Hugo");
    expect(one.podium[2]).toBeNull();
    expect(buildLeaderboardView([], "points", null).podium).toEqual([]);
    expect(podiumSlots([])).toEqual([null, null, null]);
  });

  it("utilisateur connecté hors du haut du classement : ligne à part", () => {
    const view = buildLeaderboardView(people(), "points", "u-nico", 3);
    expect(view.top.map((r) => r.entry.username)).toEqual(["Lea", "Remi", "Hugo"]);
    expect(view.meOutside?.entry.username).toBe("Nico");
    expect(view.meOutside?.isMe).toBe(true);
    expect(view.meUnranked).toBe(false);
  });

  it("utilisateur connecté dans le haut : pas de ligne à part", () => {
    const view = buildLeaderboardView(people(), "points", "u-cam");
    expect(view.meOutside).toBeNull();
    expect(view.top.find((r) => r.isMe)?.entry.username).toBe("camille");
  });

  it("utilisateur connecté sans sticker publié, et visiteur", () => {
    expect(buildLeaderboardView(people(), "points", "u-inconnu").meUnranked).toBe(true);
    const visitor = buildLeaderboardView(people(), "points", null);
    expect(visitor.meUnranked).toBe(false);
    expect(visitor.top.some((r) => r.isMe)).toBe(false);
  });
});

describe("lignes SQL", () => {
  it("convertit une ligne de get_leaderboard, avec l'URL publique de l'avatar", () => {
    const entry = toEntry(
      {
        user_id: "u1",
        username: "tomi_fan",
        avatar_path: "u1/avatar 1.webp",
        period: "all",
        points: 85,
        countries: 1,
        stickers: 1,
        rank_points: 2,
        rank_countries: 1,
        rank_stickers: 3,
      },
      "https://abc.supabase.co",
    );
    expect(entry).toEqual({
      userId: "u1",
      username: "tomi_fan",
      avatarUrl: "https://abc.supabase.co/storage/v1/object/public/avatars/u1/avatar%201.webp",
      points: 85,
      countries: 1,
      stickers: 1,
      rankPoints: 2,
      rankCountries: 1,
      rankStickers: 3,
    });
  });
});
