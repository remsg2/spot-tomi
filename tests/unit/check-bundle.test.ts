import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanDirectories } from "../../scripts/check-bundle.mjs";

type Scan = { scanned: number; findings: { rule: string }[] };

function makeBundle(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "bundle-"));
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), content);
  }
  return dir;
}

describe("check-bundle", () => {
  it("accepte un bundle sans valeur Supabase", () => {
    const dir = makeBundle({ "chunks/app.js": "console.log('Spot Tomi')" });
    const result = scanDirectories([dir]) as Scan;
    expect(result.scanned).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it("détecte une URL de projet Supabase gravée", () => {
    const dir = makeBundle({
      "chunks/app.js": 'createClient("https://abcdefghijklmnop.supabase.co","x")',
    });
    const result = scanDirectories([dir]) as Scan;
    expect(result.findings.map((f) => f.rule)).toContain("URL de projet Supabase");
  });

  it("détecte une clé publishable et le Supabase local", () => {
    const dir = makeBundle({
      "a.js": "const k='sb_publishable_0123456789abcdef'",
      "b.js": "fetch('http://127.0.0.1:54321/rest/v1')",
    });
    const rules = (scanDirectories([dir]) as Scan).findings.map((f) => f.rule);
    expect(rules).toEqual(
      expect.arrayContaining(["Clé publishable Supabase", "Supabase local"]),
    );
  });

  it("détecte la valeur exacte d'une variable d'environnement", () => {
    const dir = makeBundle({ "a.js": "const u='https://api.mon-domaine.fr'" });
    const result = scanDirectories([dir], ["https://api.mon-domaine.fr"]) as Scan;
    expect(result.findings).toHaveLength(1);
  });
});
