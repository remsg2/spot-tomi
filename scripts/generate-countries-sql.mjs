#!/usr/bin/env node
// Génère supabase/migrations/20261122000001_pays.sql à partir des pays Natural Earth v5.1.2
// 1:50m (admin 0, domaine public).
//
//   node scripts/generate-countries-sql.mjs                   # télécharge la source
//   node scripts/generate-countries-sql.mjs chemin.geojson    # fichier déjà téléchargé
//
// Derrière un proxy, télécharger d'abord avec curl :
//   curl -o /tmp/ne_50m.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson
//
// Les coordonnées sont arrondies à 4 décimales (~11 m, bien en deçà de la précision du
// 1:50m) ; la migration répare les géométries avec ST_MakeValid. Les niveaux par défaut
// (spécifications, 3.1) sont appliqués à la fin du fichier par des UPDATE lisibles.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson";
const OUTPUT = fileURLToPath(
  new URL("../supabase/migrations/20261122000001_pays.sql", import.meta.url),
);
const DECIMALS = 4;

// Entités sans code ISO à deux lettres : rattachées à l'État qui les administre ou les
// revendique, pour qu'un sticker posé là ait quand même un pays.
const ISO2_OVERRIDES = {
  SOL: "SO", // Somaliland → Somalie
  CYN: "CY", // Chypre du Nord → Chypre
  KAS: "IN", // glacier de Siachen → Inde (contrôle de fait)
};

// Niveaux par défaut (spécifications, 3.1). Tout pays absent de ces listes est « lointain ».
const TIERS = {
  courant: {
    comment: "Europe de l'Ouest et centrale, États-Unis, Canada",
    codes: [
      // Europe de l'Ouest
      "FR", "BE", "NL", "LU", "MC", "GB", "IE", "JE", "GG", "IM",
      // Europe du Sud-Ouest
      "ES", "PT", "AD", "IT", "SM", "VA", "MT",
      // Europe du Nord
      "IS", "NO", "SE", "FI", "DK", "AX",
      // Europe centrale
      "DE", "AT", "CH", "LI", "PL", "CZ", "SK", "HU", "SI", "HR",
      // Amérique du Nord
      "US", "CA",
    ],
  },
  rare: {
    comment: "pays peu visités et îles isolées",
    codes: [
      // Pays rarement visités
      "BT", "TM", "ER", "SS", "CF", "TD", "SO", "YE", "LY", "AF",
      // Îles isolées
      "PN", "SH", "FK", "GS", "HM", "TF", "IO", "KI", "TV", "NR", "MH", "FM", "PW",
      "NU", "CK", "WF", "NF", "GL",
    ],
  },
  extreme: {
    comment: "Corée du Nord, Antarctique",
    codes: ["KP", "AQ"],
  },
};

function iso2Of(p) {
  if (/^[A-Z]{2}$/.test(p.ISO_A2_EH)) return p.ISO_A2_EH;
  if (/^[A-Z]{2}$/.test(p.ISO_A2)) return p.ISO_A2;
  return ISO2_OVERRIDES[p.ADM0_A3] ?? null;
}

function iso3Of(p) {
  if (/^[A-Z]{3}$/.test(p.ISO_A3_EH)) return p.ISO_A3_EH;
  if (/^[A-Z]{3}$/.test(p.ISO_A3)) return p.ISO_A3;
  return p.ADM0_A3;
}

const factor = 10 ** DECIMALS;
const round = (n) => Math.round(n * factor) / factor;

/** Arrondit un anneau et retire les points consécutifs devenus identiques. */
function roundRing(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const pt = [round(x), round(y)];
    const last = out[out.length - 1];
    if (!last || last[0] !== pt[0] || last[1] !== pt[1]) out.push(pt);
  }
  const [fx, fy] = out[0];
  const [lx, ly] = out[out.length - 1];
  if (fx !== lx || fy !== ly) out.push([fx, fy]);
  return out.length >= 4 ? out : null;
}

function polygonsOf(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const out = [];
  for (const poly of polys) {
    const [outer, ...holes] = poly.map(roundRing);
    if (!outer) continue;
    out.push([outer, ...holes.filter(Boolean)]);
  }
  return out;
}

const sqlText = (s) => `'${String(s).replaceAll("'", "''")}'`;

async function loadSource(arg) {
  if (arg) return JSON.parse(await readFile(arg, "utf8"));
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status}) : ${SOURCE_URL}`);
  return response.json();
}

const data = await loadSource(process.argv[2]);

/** @type {Map<string, {iso3: string, name: string, main: boolean, polygons: number[][][][]}>} */
const countries = new Map();
for (const { properties: p, geometry } of data.features) {
  const iso2 = iso2Of(p);
  if (!iso2) {
    console.warn(`Ignoré (pas de code ISO) : ${p.NAME}`);
    continue;
  }
  // Entité principale : celle dont le code ISO est le sien (pas un rattachement).
  const main = iso2Of({ ...p, ADM0_A3: "" }) === iso2 && p.TYPE !== "Dependency";
  const name = (p.NAME_FR || p.NAME).trim();
  const entry = countries.get(iso2);
  const polygons = polygonsOf(geometry);
  if (!entry) {
    countries.set(iso2, { iso3: iso3Of(p), name, main, polygons });
  } else {
    entry.polygons.push(...polygons);
    if (main && !entry.main) Object.assign(entry, { iso3: iso3Of(p), name, main });
  }
}

const tierOf = new Map();
for (const [tier, { codes }] of Object.entries(TIERS)) {
  for (const code of codes) tierOf.set(code, tier);
}
const missing = [...tierOf.keys()].filter((code) => !countries.has(code));
if (missing.length) console.warn(`Codes de niveau absents de la source : ${missing.join(", ")}`);

const rows = [...countries.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([iso2, c]) => {
    const geojson = JSON.stringify({ type: "MultiPolygon", coordinates: c.polygons });
    return `(${sqlText(iso2)}, ${sqlText(c.iso3)}, ${sqlText(c.name)}, ${sqlText(geojson)})`;
  });

const tierUpdates = Object.entries(TIERS)
  .map(([tier, { comment, codes }]) => {
    const present = codes.filter((code) => countries.has(code));
    return `-- ${tier} : ${comment}\nupdate public.countries set tier = '${tier}'\nwhere iso2 in (${present.map(sqlText).join(", ")});`;
  })
  .join("\n\n");

const sql = `-- Étape 4 · Pays (données) : frontières Natural Earth 1:50m admin 0 et niveaux par défaut.
-- FICHIER GÉNÉRÉ par scripts/generate-countries-sql.mjs : ne pas modifier à la main.
-- Source : ${SOURCE_URL}
-- (Natural Earth v5.1.2, domaine public). Coordonnées arrondies à ${DECIMALS} décimales.
-- Rattachements : Somaliland → SO, Chypre du Nord → CY, glacier de Siachen → IN,
-- territoires australiens de l'océan Indien et îles Ashmore-et-Cartier → AU.
-- Natural Earth inclut les départements d'outre-mer dans la France (FR).

insert into public.countries (iso2, iso3, name_fr, geom)
select
  iso2,
  iso3,
  name_fr,
  extensions.st_multi(
    extensions.st_collectionextract(
      extensions.st_makevalid(extensions.st_setsrid(extensions.st_geomfromgeojson(geojson), 4326)),
      3
    )
  )::extensions.geography
from (values
${rows.join(",\n")}
) as source (iso2, iso3, name_fr, geojson);

-- Niveaux par défaut (spécifications, 3.1), ajustables dans l'admin (onglet Barème).
${tierUpdates}

-- Version du schéma ------------------------------------------------------------

create or replace function public.schema_version()
returns text
language sql
stable
set search_path = ''
as $$ select '20261122000001_pays'::text $$;
`;

await writeFile(OUTPUT, sql);
console.log(`${countries.size} pays écrits dans ${OUTPUT} (${(sql.length / 1e6).toFixed(1)} Mo)`);
