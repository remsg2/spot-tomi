import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";
import { authErrorMessage } from "@/lib/auth/errors";
import { homeSchema, usernameSchema } from "./profile";

describe("usernameSchema", () => {
  it("accepte 3 à 20 lettres, chiffres ou _", () => {
    for (const ok of ["abc", "Tomi_Fan", "x".repeat(20), "remi_98"]) {
      expect(usernameSchema.safeParse(ok).success, ok).toBe(true);
    }
  });

  it("refuse les accents, espaces, tirets et longueurs hors limites", () => {
    for (const ko of ["ab", "x".repeat(21), "rémi", "tomi fan", "tomi-fan", ""]) {
      expect(usernameSchema.safeParse(ko).success, ko).toBe(false);
    }
  });

  it("ignore les espaces autour", () => {
    expect(usernameSchema.parse("  tomi  ")).toBe("tomi");
  });
});

describe("homeSchema", () => {
  it("borne la latitude et la longitude", () => {
    expect(homeSchema.safeParse({ lat: 45.1, lng: 6.9 }).success).toBe(true);
    expect(homeSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
    expect(homeSchema.safeParse({ lat: 0, lng: -181 }).success).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("garde un chemin du site", () => {
    expect(safeNextPath("/me/settings?x=1")).toBe("/me/settings?x=1");
  });

  it("refuse les redirections vers un autre site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", null]) {
      expect(safeNextPath(bad), String(bad)).toBe("/");
    }
  });
});

describe("authErrorMessage", () => {
  it("traduit les codes connus et donne un message par défaut", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("Email ou mot de passe incorrect.");
    expect(authErrorMessage({ code: "email_exists" })).toContain("existe déjà");
    expect(authErrorMessage({ code: "inconnu" })).toBe("Une erreur est survenue. Réessaie.");
  });
});
