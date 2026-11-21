#!/usr/bin/env node
// Génère supabase/migrations/20261201000001_geo_extras.sql : continent de chaque pays et
// grands déserts, pour les statistiques, records, classements et badges (lot 2).
//
// Source : Natural Earth v5.1.2 (domaine public), mêmes fichiers figés que les pays.
//   curl -o /tmp/ne_50m_admin0.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
//   curl -o /tmp/ne_50m_regions.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_geography_regions_polys.geojson
//   node scripts/generate-geo-extras-sql.mjs /tmp/ne_50m_admin0.geojson /tmp/ne_50m_regions.geojson

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUTPUT = fileURLToPath(new URL("../supabase/migrations/20261201000001_geo_extras.sql", import.meta.url));

// Mêmes rattachements que scripts/generate-countries-sql.mjs.
const ISO2_OVERRIDES = { SOL: "SO", CYN: "CY", KAS: "IN" };

function iso2Of(p) {
  if (/^[A-Z]{2}$/.test(p.ISO_A2_EH)) return p.ISO_A2_EH;
  if (/^[A-Z]{2}$/.test(p.ISO_A2)) return p.ISO_A2;
  return ISO2_OVERRIDES[p.ADM0_A3] ?? null;
}

const CONTINENTS = {
  Africa: "afrique",
  Antarctica: "antarctique",
  Asia: "asie",
  Europe: "europe",
  "North America": "amerique_nord",
  "South America": "amerique_sud",
  Oceania: "oceanie",
};

// « Seven seas (open ocean) » : rattachés selon la région de l'ONU.
const REGION_UN = {
  Africa: "afrique",
  Asia: "asie",
  Europe: "europe",
  Oceania: "oceanie",
  Americas: "amerique_sud",
  Antarctica: "antarctique",
};

// Classés « Desert » par Natural Earth mais qui n'en sont pas au sens du badge.
const NOT_DESERTS = new Set(["PUNJAB", "CAATINGAS"]);

const DECIMALS = 3;
const factor = 10 ** DECIMALS;
const round = (n) => Math.round(n * factor) / factor;
const roundGeometry = (coordinates) =>
  Array.isArray(coordinates[0]) ? coordinates.map(roundGeometry) : coordinates.map(round);
const sqlText = (s) => `'${String(s).replaceAll("'", "''")}'`;

const SMALL_WORDS = new Set(["de", "du", "des", "la", "le", "les", "e", "n", "oua", "al", "ar"]);

function titleCase(name) {
  return name
    .toLowerCase()
    .split(/([\s-]+)/)
    .map((word, index) =>
      index === 0 || !SMALL_WORDS.has(word) ? word.replace(/^(\p{L})/u, (letter) => letter.toUpperCase()) : word,
    )
    .join("");
}

async function main() {
  const [countriesPath, regionsPath] = process.argv.slice(2);
  if (!countriesPath || !regionsPath) {
    console.error("Usage : node scripts/generate-geo-extras-sql.mjs admin0.geojson regions.geojson");
    process.exit(1);
  }
  const countries = JSON.parse(await readFile(countriesPath, "utf8"));
  const regions = JSON.parse(await readFile(regionsPath, "utf8"));

  const continentOf = new Map();
  for (const feature of countries.features) {
    const p = feature.properties;
    const iso2 = iso2Of(p);
    if (!iso2) continue;
    const continent = CONTINENTS[p.CONTINENT] ?? REGION_UN[p.REGION_UN];
    if (!continent) throw new Error(`Continent inconnu pour ${iso2} : ${p.CONTINENT} / ${p.REGION_UN}`);
    // Le territoire principal l'emporte sur une dépendance de même code.
    if (!continentOf.has(iso2) || p.TYPE !== "Dependency") continentOf.set(iso2, continent);
  }

  const deserts = regions.features
    .filter((f) => f.properties.FEATURECLA === "Desert" && !NOT_DESERTS.has(f.properties.NAME))
    .map((f) => ({
      name: titleCase(f.properties.NAME_FR || f.properties.NAME),
      geometry: { type: f.geometry.type, coordinates: roundGeometry(f.geometry.coordinates) },
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const continentRows = [...continentOf.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso2, continent]) => `('${iso2}','${continent}')`);

  const sql = [
    "-- Lot 2 · Continents des pays et grands déserts (données).",
    "-- FICHIER GÉNÉRÉ par scripts/generate-geo-extras-sql.mjs : ne pas modifier à la main.",
    "-- Source : Natural Earth v5.1.2 (domaine public), admin 0 et geography_regions_polys 1:50m.",
    "",
    "update public.countries c",
    "set continent = v.continent::public.continent",
    "from (values",
    continentRows.join(",\n"),
    ") as v (iso2, continent)",
    "where c.iso2 = v.iso2;",
    "",
    "insert into public.deserts (name, geom)",
    "select name, extensions.st_multi(extensions.st_makevalid(",
    "  extensions.st_setsrid(extensions.st_geomfromgeojson(geojson), 4326)))::extensions.geography",
    "from (values",
    deserts.map((d) => `(${sqlText(d.name)},${sqlText(JSON.stringify(d.geometry))})`).join(",\n"),
    ") as v (name, geojson);",
    "",
  ].join("\n");
  await writeFile(OUTPUT, sql);
  console.log(`${continentRows.length} pays, ${deserts.length} déserts écrits dans ${OUTPUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
