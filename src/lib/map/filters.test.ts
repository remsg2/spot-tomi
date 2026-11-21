import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filtersKey,
  filtersToRpc,
  setMine,
  setPeriod,
  setPerson,
  toggleCountry,
  toggleYear,
} from "./filters";

describe("filtersToRpc", () => {
  it("aucun filtre : objet vide (toute la carte)", () => {
    expect(filtersToRpc(DEFAULT_FILTERS)).toEqual({});
  });

  it("traduit chaque filtre selon le contrat de spots_in_bbox", () => {
    expect(
      filtersToRpc({
        ...DEFAULT_FILTERS,
        years: [2025, 2026, 2025],
        person: { id: "00000000-0000-0000-0000-0000000000b6", username: "lea" },
        rare: true,
        countries: [
          { iso2: "IT", name: "Italie" },
          { iso2: "FR", name: "France" },
        ],
        from: "2026-01-01",
        to: "pas une date",
      }),
    ).toEqual({
      years: [2026, 2025],
      authorId: "00000000-0000-0000-0000-0000000000b6",
      rare: true,
      countries: ["FR", "IT"],
      from: "2026-01-01",
    });
    expect(filtersToRpc({ ...DEFAULT_FILTERS, mine: true })).toEqual({ mine: true });
  });

  it("la clé ne dépend pas de l'ordre des années", () => {
    expect(filtersKey({ ...DEFAULT_FILTERS, years: [2024, 2026] })).toBe(
      filtersKey({ ...DEFAULT_FILTERS, years: [2026, 2024] }),
    );
  });
});

describe("modifications des filtres", () => {
  it("ajoute puis retire une année", () => {
    const once = toggleYear(DEFAULT_FILTERS, 2026);
    expect(once.years).toEqual([2026]);
    expect(toggleYear(once, 2026).years).toEqual([]);
  });

  it("« Mes stickers » et une personne s'excluent", () => {
    const person = setPerson(DEFAULT_FILTERS, { id: "x", username: "lea" });
    const mine = setMine(person, true);
    expect(mine).toMatchObject({ mine: true, person: null });
    expect(setPerson(mine, { id: "y", username: "hugo" })).toMatchObject({ mine: false, person: { id: "y" } });
  });

  it("compte les filtres actifs", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, years: [2025, 2026], rare: true, mine: true })).toBe(3);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, countries: [{ iso2: "FR", name: "France" }], to: "2026-06-01" })).toBe(2);
  });

  it("ajoute puis retire un pays (code en majuscules)", () => {
    const once = toggleCountry(DEFAULT_FILTERS, { iso2: "fr", name: "France" });
    expect(once.countries).toEqual([{ iso2: "FR", name: "France" }]);
    expect(toggleCountry(once, { iso2: "FR", name: "France" }).countries).toEqual([]);
  });

  it("période : bornes remises dans l'ordre, valeur invalide ignorée", () => {
    expect(setPeriod(DEFAULT_FILTERS, "2026-06-01", "2026-01-01")).toMatchObject({ from: "2026-01-01", to: "2026-06-01" });
    expect(setPeriod(DEFAULT_FILTERS, "hier", null)).toMatchObject({ from: null, to: null });
  });
});
