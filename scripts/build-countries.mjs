#!/usr/bin/env node
/**
 * Génère public/geo/countries-110m.json : frontières légères des pays pour la
 * coloration de la carte au dézoom (spécifications 2.3), sans service externe
 * au runtime.
 *
 * Source : Natural Earth 1:110m, admin 0 (domaine public), version figée.
 * On ne garde que le code ISO 3166-1 alpha-2 (même clé que countries.iso2 et la
 * vue country_rarity) et des coordonnées arrondies à 0,01° (~1 km).
 *
 * Usage : node scripts/build-countries.mjs [fichier-source.geojson]
 * Sans argument, la source est téléchargée depuis GitHub (tag figé ci-dessous).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NATURAL_EARTH_TAG = "v5.1.2";
const SOURCE_URL = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NATURAL_EARTH_TAG}/geojson/ne_110m_admin_0_countries.geojson`;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "public/geo/countries-110m.json");
const PRECISION = 100; // 0,01°

/** Code ISO2 fiable : ISO_A2_EH corrige les « -99 » de ISO_A2 (France, Norvège…). */
export function isoCode(properties) {
  for (const key of ["ISO_A2_EH", "ISO_A2", "WB_A2"]) {
    const value = String(properties[key] ?? "").toUpperCase();
    if (/^[A-Z]{2}$/.test(value)) return value;
  }
  return null;
}

function roundRing(ring) {
  const out = [];
  for (const [lng, lat] of ring) {
    const point = [Math.round(lng * PRECISION) / PRECISION, Math.round(lat * PRECISION) / PRECISION];
    const last = out[out.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) out.push(point);
  }
  // Un anneau valide a au moins 4 positions (le premier point répété à la fin).
  if (out.length < 4) return null;
  const [first] = out;
  const end = out[out.length - 1];
  if (first[0] !== end[0] || first[1] !== end[1]) out.push(first);
  return out;
}

function roundPolygon(polygon) {
  const rings = polygon.map(roundRing).filter(Boolean);
  return rings.length > 0 && rings[0] ? rings : null;
}

export function simplify(collection) {
  const features = [];
  for (const feature of collection.features) {
    const iso2 = isoCode(feature.properties ?? {});
    if (!iso2 || !feature.geometry) continue;
    const { type, coordinates } = feature.geometry;
    const polygons = (type === "Polygon" ? [coordinates] : coordinates)
      .map(roundPolygon)
      .filter(Boolean);
    if (polygons.length === 0) continue;
    features.push({
      type: "Feature",
      properties: { iso2 },
      geometry:
        polygons.length === 1
          ? { type: "Polygon", coordinates: polygons[0] }
          : { type: "MultiPolygon", coordinates: polygons },
    });
  }
  features.sort((a, b) => a.properties.iso2.localeCompare(b.properties.iso2));
  return { type: "FeatureCollection", features };
}

async function main() {
  const [sourcePath] = process.argv.slice(2);
  const source = sourcePath
    ? JSON.parse(readFileSync(sourcePath, "utf8"))
    : await (await fetch(SOURCE_URL)).json();
  const result = simplify(source);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(result));
  const size = Buffer.byteLength(JSON.stringify(result));
  console.log(`${result.features.length} pays écrits dans ${OUTPUT} (${Math.round(size / 1024)} Ko).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
