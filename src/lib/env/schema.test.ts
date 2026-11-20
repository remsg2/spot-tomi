import { describe, expect, it } from "vitest";
import { parsePublicEnv, serializePublicEnv } from "./schema";

const KEY = "sb_publishable_abcdefghijklmnopqrstuvwxyz";

describe("parsePublicEnv", () => {
  it("lit une configuration complète", () => {
    const result = parsePublicEnv({
      SUPABASE_URL: "https://abcdefghij.supabase.co/",
      SUPABASE_PUBLISHABLE_KEY: KEY,
      APP_ENV: "staging",
    });
    expect(result).toEqual({
      ok: true,
      env: {
        appEnv: "staging",
        supabaseUrl: "https://abcdefghij.supabase.co",
        supabaseKey: KEY,
      },
    });
  });

  it("accepte l'ancienne clé anon en repli et APP_ENV local par défaut", () => {
    const result = parsePublicEnv({
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: KEY,
    });
    expect(result.ok && result.env.appEnv).toBe("local");
    expect(result.ok && result.env.supabaseKey).toBe(KEY);
  });

  it("signale les variables manquantes sans planter", () => {
    const result = parsePublicEnv({ APP_ENV: "production" });
    expect(result).toEqual({
      ok: false,
      appEnv: "production",
      missing: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
    });
  });

  it("refuse une URL qui n'est pas http(s)", () => {
    const result = parsePublicEnv({
      SUPABASE_URL: "javascript:alert(1)",
      SUPABASE_PUBLISHABLE_KEY: KEY,
    });
    expect(result.ok).toBe(false);
  });

  it("ignore un APP_ENV inconnu en cas d'erreur", () => {
    const result = parsePublicEnv({ APP_ENV: "recette" });
    expect(result.ok === false && result.appEnv).toBe("local");
  });
});

describe("serializePublicEnv", () => {
  it("échappe tout ce qui pourrait fermer la balise <script>", () => {
    const json = serializePublicEnv({
      ok: false,
      appEnv: "local",
      missing: ["</script><script>alert(1)</script>"],
    });
    expect(json).not.toContain("<");
    expect(json).not.toContain(">");
    expect(JSON.parse(json).missing[0]).toBe("</script><script>alert(1)</script>");
  });
});
