#!/usr/bin/env node
/**
 * Outils pour promouvoir une seule build Vercel (.vercel/output) d'un
 * environnement à l'autre sans la reconstruire.
 *
 *   node scripts/vercel-output.mjs fingerprint
 *     Affiche l'empreinte SHA-256 de toute la sortie, hors builds.json.
 *
 *   node scripts/vercel-output.mjs retarget <cible>
 *     Change la cible enregistrée dans builds.json (production, staging…).
 *
 * Pourquoi : `vercel deploy --prebuilt` refuse une sortie construite pour
 * une autre cible. Comme l'app ne lit aucune valeur d'environnement au
 * build, la sortie est identique quelle que soit la cible : seul ce champ
 * de métadonnées diffère. L'empreinte prouve que rien d'autre ne change.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_DIR = ".vercel/output";
const BUILDS_FILE = join(OUTPUT_DIR, "builds.json");

function* walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield { path, entry };
  }
}

export function fingerprint(dir = OUTPUT_DIR) {
  const hash = createHash("sha256");
  for (const { path, entry } of walk(dir)) {
    const rel = relative(dir, path);
    if (rel === "builds.json") continue;
    hash.update(rel);
    hash.update("\0");
    if (entry.isSymbolicLink()) hash.update(`link:${readlinkSync(path)}`);
    else hash.update(readFileSync(path));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function retarget(target, file = BUILDS_FILE) {
  const builds = JSON.parse(readFileSync(file, "utf8"));
  if (typeof builds.target !== "string") {
    throw new Error(`${file} ne contient pas de champ "target" : format Vercel inattendu.`);
  }
  const previous = builds.target;
  builds.target = target;
  writeFileSync(file, `${JSON.stringify(builds, null, 2)}\n`);
  return previous;
}

function main() {
  const [command, arg] = process.argv.slice(2);
  if (command === "fingerprint") {
    console.log(fingerprint());
  } else if (command === "retarget" && arg) {
    const previous = retarget(arg);
    console.log(`Cible de la build : ${previous} → ${arg}`);
  } else {
    console.error("Usage : vercel-output.mjs fingerprint | retarget <cible>");
    process.exit(2);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
