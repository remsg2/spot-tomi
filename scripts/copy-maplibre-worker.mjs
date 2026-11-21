#!/usr/bin/env node
/**
 * MapLibre GL 6 exécute son rendu de tuiles dans un Web Worker livré à part
 * (dist/maplibre-gl-worker.mjs). Le bundler de l'app ne le copie pas : ce script
 * le place dans public/vendor/, avec la version dans le nom (cache immuable),
 * avant `next dev` et `next build` (scripts predev et prebuild).
 * Le fichier copié n'est pas versionné (voir .gitignore).
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = join(ROOT, "node_modules", "maplibre-gl");
const { version } = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
const source = join(packageDir, "dist", "maplibre-gl-worker.mjs");
const outDir = join(ROOT, "public", "vendor");
const target = join(outDir, `maplibre-gl-worker-${version}.mjs`);

mkdirSync(outDir, { recursive: true });
// Supprime les copies d'anciennes versions.
for (const file of readdirSync(outDir)) {
  if (file.startsWith("maplibre-gl-worker-") && join(outDir, file) !== target) {
    rmSync(join(outDir, file));
  }
}
copyFileSync(source, target);
console.log(`Worker MapLibre ${version} copié dans public/vendor/.`);
