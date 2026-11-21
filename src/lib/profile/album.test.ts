import { describe, expect, it } from "vitest";
import {
  albumLegend,
  buildAlbumView,
  chooseCountriesToConquer,
  tileTilt,
  type AlbumRow,
  type CountryTier,
} from "./album";
import { exactIlikePattern, sinceYear, toAlbumRow } from "./mappers";

function conquered(iso3: string, year: number, color: string, points: number, gold = false): AlbumRow {
  return {
    iso2: iso3.slice(0, 2),
    iso3,
    nameFr: iso3,
    tier: "lointain",
    conquered: true,
    firstYear: year,
    colorHex: color,
    points,
    stickers: 1,
    gold,
    suggestionRank: null,
  };
}

const BASE: Record<CountryTier, number> = { courant: 10, lointain: 25, rare: 60, extreme: 150 };

function candidate(iso3: string, tier: CountryTier, rank: number): AlbumRow {
  return {
    iso2: iso3.slice(0, 2),
    iso3,
    nameFr: iso3,
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

/** Trois suggestions par niveau, comme public.album(). */
const CANDIDATES: AlbumRow[] = [
  candidate("PRK", "extreme", 1),
  candidate("ATA", "extreme", 2),
  candidate("BTN", "rare", 1),
  candidate("TKM", "rare", 2),
  candidate("TUV", "rare", 3),
  candidate("JPN", "lointain", 1),
  candidate("PER", "lointain", 2),
  candidate("CHL", "lointain", 3),
  candidate("NOR", "courant", 1),
  candidate("DEU", "courant", 2),
  candidate("AUT", "courant", 3),
];

describe("pays à conquérir", () => {
  it("un par niveau encore ouvert, du moins cher au plus cher (maquette Profil)", () => {
    const chosen = chooseCountriesToConquer(CANDIDATES, 8);
    expect(chosen.map((c) => c.iso3)).toEqual(["NOR", "JPN", "BTN", "PRK"]);
    expect(chosen.map((c) => c.points)).toEqual([10, 25, 60, 150]);
  });

  it("complète la dernière rangée de la grille de 4", () => {
    const chosen = chooseCountriesToConquer(CANDIDATES, 5);
    expect((5 + chosen.length) % 4).toBe(0);
    expect(chosen).toHaveLength(7);
    // D'abord un par niveau, puis les deuxièmes suggestions.
    expect(chosen.map((c) => c.iso3)).toEqual(expect.arrayContaining(["NOR", "JPN", "BTN", "PRK", "DEU", "PER", "TKM"]));
    expect(chosen.map((c) => c.iso3)).not.toContain("ATA");
  });

  it("nouvel utilisateur : une rangée de quatre suggestions", () => {
    expect(chooseCountriesToConquer(CANDIDATES, 0)).toHaveLength(4);
  });

  it("niveau entièrement conquis : pas de suggestion pour lui", () => {
    const sansExtreme = CANDIDATES.filter((c) => c.tier !== "extreme");
    const chosen = chooseCountriesToConquer(sansExtreme, 9);
    expect(chosen.map((c) => c.tier)).not.toContain("extreme");
    expect((9 + chosen.length) % 4).toBe(0);
  });

  it("jamais un pays déjà conquis, et rien sans candidat", () => {
    const rows = [...CANDIDATES, conquered("FRA", 2025, "#FF7A59", 100)];
    expect(chooseCountriesToConquer(rows, 1).map((c) => c.iso3)).not.toContain("FRA");
    expect(chooseCountriesToConquer([], 3)).toEqual([]);
  });

  it("s'arrête quand il n'y a plus de suggestions", () => {
    const few = [candidate("NOR", "courant", 1), candidate("DEU", "courant", 2)];
    expect(chooseCountriesToConquer(few, 1).map((c) => c.iso3)).toEqual(["NOR", "DEU"]);
  });
});

describe("album", () => {
  const rows: AlbumRow[] = [
    conquered("ISL", 2026, "#5B8DEF", 160, true),
    conquered("FRA", 2024, "#F2C230", 312),
    conquered("ARG", 2027, "#5DB043", 195, true),
    conquered("ESP", 2025, "#FF7A59", 96),
    conquered("MAR", 2025, "#FF7A59", 120, true),
    ...CANDIDATES,
  ];

  it("tuiles dans l'ordre de conquête, avec couleur et anneau doré", () => {
    const view = buildAlbumView(rows);
    expect(view.conquered.map((t) => t.iso3)).toEqual(["FRA", "ESP", "MAR", "ISL", "ARG"]);
    expect(view.conquered[0]).toMatchObject({ year: 2024, color: "#F2C230", points: 312, gold: false });
    expect(view.conquered.find((t) => t.iso3 === "ARG")?.gold).toBe(true);
    expect((view.conquered.length + view.toConquer.length) % 4).toBe(0);
  });

  it("légende : une entrée par année, dans l'ordre, en deux chiffres", () => {
    const legend = buildAlbumView(rows).legend;
    expect(legend).toEqual([
      { year: 2024, color: "#F2C230", short: "24" },
      { year: 2025, color: "#FF7A59", short: "25" },
      { year: 2026, color: "#5B8DEF", short: "26" },
      { year: 2027, color: "#5DB043", short: "27" },
    ]);
    expect(albumLegend([])).toEqual([]);
  });

  it("couleur absente : gris des années sans couleur", () => {
    const view = buildAlbumView([{ ...conquered("PER", 2023, "#000000", 25), colorHex: null }]);
    expect(view.conquered[0].color).toBe("#9A9A94");
  });

  it("rotation légère et stable par pays", () => {
    expect(tileTilt("ARG")).toBe(tileTilt("ARG"));
    for (const code of ["ARG", "FRA", "MAR", "ESP", "ITA", "PRT", "GBR", "ISL"]) {
      const tilt = tileTilt(code);
      expect(Math.abs(tilt)).toBeGreaterThan(0);
      expect(Math.abs(tilt)).toBeLessThanOrEqual(3);
    }
  });
});

describe("lignes SQL du profil", () => {
  it("convertit une ligne de public.album", () => {
    expect(
      toAlbumRow({
        iso2: "AR",
        iso3: "ARG",
        name_fr: "Argentine",
        tier: "lointain",
        conquered: true,
        first_year: 2027,
        color_hex: "#5DB043",
        points: 195,
        stickers: 2,
        gold: true,
        suggestion_rank: null,
      }),
    ).toEqual({
      iso2: "AR",
      iso3: "ARG",
      nameFr: "Argentine",
      tier: "lointain",
      conquered: true,
      firstYear: 2027,
      colorHex: "#5DB043",
      points: 195,
      stickers: 2,
      gold: true,
      suggestionRank: null,
    });
  });

  it("pseudo exact en ILIKE : le _ n'est pas un joker", () => {
    expect(exactIlikePattern("tomi_fan")).toBe("tomi\\_fan");
    expect(exactIlikePattern("remi")).toBe("remi");
  });

  it("année d'inscription", () => {
    expect(sinceYear("2024-03-02T10:00:00Z")).toBe(2024);
  });
});
