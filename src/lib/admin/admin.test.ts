import { describe, expect, it } from "vitest";
import { ta } from "@/i18n/admin.fr";
import { auditChanges, auditSubject } from "./audit";
import { adminErrorMessage } from "./errors";
import { adminHome, canAccess, staffLevel, visibleTabs } from "./roles";
import { groupRules, matchesCountry } from "./rules";

describe("rôles", () => {
  it("suit is_admin() et is_moderator() : un compte suspendu n'a plus de droits", () => {
    expect(staffLevel({ role: "admin", suspended_at: null })).toBe("admin");
    expect(staffLevel({ role: "moderator", suspended_at: null })).toBe("moderator");
    expect(staffLevel({ role: "user", suspended_at: null })).toBeNull();
    expect(staffLevel({ role: "admin", suspended_at: "2026-11-01T00:00:00Z" })).toBeNull();
    expect(staffLevel(null)).toBeNull();
  });

  it("donne la modération aux admins, pas les onglets admin aux modérateurs", () => {
    expect(canAccess("admin", "moderator")).toBe(true);
    expect(canAccess("moderator", "moderator")).toBe(true);
    expect(canAccess("moderator", "admin")).toBe(false);
    expect(canAccess(null, "moderator")).toBe(false);
  });

  it("n'affiche que les onglets permis", () => {
    expect(visibleTabs("admin").map((tab) => tab.tab)).toEqual([
      "season",
      "moderation",
      "scoring",
      "roles",
      "badges",
      "errors",
      "journal",
    ]);
    expect(visibleTabs("moderator").map((tab) => tab.tab)).toEqual(["moderation"]);
    expect(visibleTabs(null)).toEqual([]);
    expect(adminHome("admin")).toBe("/admin/season");
    expect(adminHome("moderator")).toBe("/admin/moderation");
  });
});

describe("erreurs", () => {
  it("traduit les codes des fonctions admin, sans détail technique", () => {
    expect(adminErrorMessage({ code: "ST801", message: "Contraste insuffisant…" })).toBe(ta.errors.contrast);
    expect(adminErrorMessage({ code: "ST802" })).toBe(ta.errors.lastAdmin);
    expect(adminErrorMessage({ code: "42501" })).toBe(ta.errors.forbidden);
    expect(adminErrorMessage({ code: "XX000", message: "relation secrète" })).toBe(ta.errors.default);
    expect(adminErrorMessage(null)).toBe(ta.errors.default);
  });
});

describe("barème", () => {
  it("groupe les règles connues et garde les nouvelles dans « Autres »", () => {
    const rule = (key: string) => ({ key, value: 1, updated_at: "2026-11-21T00:00:00Z" });
    const groups = groupRules([
      rule("edit_window_days"),
      rule("bonus_isole"),
      rule("base_points"),
      rule("isole_city_km"),
      rule("bonus_meteo"),
    ]);
    expect(groups.map((group) => [group.group, group.rules.map((r) => r.key)])).toEqual([
      ["base", ["base_points", "bonus_isole"]],
      ["index", ["isole_city_km"]],
      ["limits", ["edit_window_days"]],
      ["other", ["bonus_meteo"]],
    ]);
  });

  it("cherche un pays sans accents, par nom ou code", () => {
    const country = { iso2: "PE", iso3: "PER", name_fr: "Pérou" };
    expect(matchesCountry(country, "perou")).toBe(true);
    expect(matchesCountry(country, "PÉR")).toBe(true);
    expect(matchesCountry(country, "pe")).toBe(true);
    expect(matchesCountry(country, "per")).toBe(true);
    expect(matchesCountry(country, "bhoutan")).toBe(false);
    expect(matchesCountry(country, "  ")).toBe(true);
  });
});

describe("journal", () => {
  it("ne montre que les champs modifiés", () => {
    const entry = {
      target: "spot:1",
      before: { id: "1", name: "Vieux-Port", status: "published", points_total: 10, reports: [{}, {}] },
      after: { id: "1", name: "Vieux-Port", status: "hidden", points_total: 10, reports: [] },
    };
    expect(auditChanges(entry)).toEqual([
      { key: "status", before: "published", after: "hidden" },
      { key: "reports", before: "2", after: "0" },
    ]);
    expect(auditSubject(entry)).toBe("Vieux-Port");
  });

  it("nomme la cible quand l'entrée n'a pas de nom", () => {
    expect(auditSubject({ target: "spots:all", before: { points_total: 1 }, after: { count: 2 } })).toBe("spots:all");
    expect(auditChanges({ before: null, after: { year: 2027, color_hex: "#5DB043" } })).toEqual([
      { key: "year", before: "—", after: "2027" },
      { key: "color_hex", before: "—", after: "#5DB043" },
    ]);
  });
});
