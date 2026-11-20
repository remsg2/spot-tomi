import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprint, retarget } from "../../scripts/vercel-output.mjs";

function makeOutput(target: string) {
  const dir = mkdtempSync(join(tmpdir(), "vc-output-"));
  mkdirSync(join(dir, "static"), { recursive: true });
  writeFileSync(join(dir, "static", "app.js"), "console.log(1)");
  writeFileSync(join(dir, "config.json"), '{"version":3}');
  writeFileSync(join(dir, "builds.json"), JSON.stringify({ target, builds: [] }));
  return dir;
}

describe("vercel-output", () => {
  it("change seulement la cible, sans modifier l'empreinte", () => {
    const dir = makeOutput("production");
    const before = fingerprint(dir);
    expect(retarget("staging", join(dir, "builds.json"))).toBe("production");
    expect(JSON.parse(readFileSync(join(dir, "builds.json"), "utf8")).target).toBe("staging");
    expect(fingerprint(dir)).toBe(before);
  });

  it("l'empreinte change dès qu'un fichier de la build change", () => {
    const dir = makeOutput("production");
    const before = fingerprint(dir);
    writeFileSync(join(dir, "static", "app.js"), "console.log(2)");
    expect(fingerprint(dir)).not.toBe(before);
  });
});
