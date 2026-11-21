#!/usr/bin/env node
// Génère supabase/migrations/20261130000001_villes.sql : les villes de plus de
// 15 000 habitants (et toutes les capitales), pour l'indice de rareté
// (« distance à la ville la plus proche ») et le badge « dans une capitale ».
//
// Source : données GeoNames (CC BY 4.0, https://www.geonames.org/), telles que
// publiées dans le paquet npm all-the-cities@3.1.0 (fichier cities.pbf, villes
// de plus de 1 000 habitants). GeoNames n'est pas joignable depuis tous les
// réseaux ; le registre npm l'est en général :
//
//   npm pack all-the-cities@3.1.0 && tar xzf all-the-cities-3.1.0.tgz
//   node scripts/generate-cities-sql.mjs package/cities.pbf
//
// Le décodeur protobuf ci-dessous est volontairement minimal (aucune dépendance) :
// il lit le format écrit par all-the-cities (messages délimités, coordonnées en
// deltas zigzag à 1e-5 degré).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUTPUT = fileURLToPath(new URL("../supabase/migrations/20261130000001_villes.sql", import.meta.url));
const MIN_POPULATION = 15000;
const BATCH = 1000;

function reader(buffer) {
  let pos = 0;
  const varint = () => {
    let result = 0;
    let shift = 0;
    for (;;) {
      const byte = buffer[pos++];
      result += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) return result;
      shift += 7;
    }
  };
  const svarint = () => {
    const n = varint();
    return n % 2 === 0 ? n / 2 : -(n + 1) / 2;
  };
  const string = () => {
    const length = varint();
    const value = buffer.toString("utf8", pos, pos + length);
    pos += length;
    return value;
  };
  const skip = (type) => {
    if (type === 0) varint();
    else if (type === 1) pos += 8;
    else if (type === 2) {
      const length = varint();
      pos += length;
    }
    else if (type === 5) pos += 4;
    else throw new Error(`Type protobuf inattendu : ${type}`);
  };
  return {
    get done() {
      return pos >= buffer.length;
    },
    get pos() {
      return pos;
    },
    varint,
    svarint,
    string,
    skip,
  };
}

export function decodeCities(buffer) {
  const r = reader(buffer);
  const cities = [];
  let lastLon = 0;
  let lastLat = 0;
  while (!r.done) {
    const end = r.varint() + r.pos;
    const city = { id: 0, name: "", country: "", featureCode: "", population: 0, lon: 0, lat: 0 };
    while (r.pos < end) {
      const key = r.varint();
      const tag = Math.floor(key / 8);
      const type = key % 8;
      if (tag === 1) city.id = r.svarint();
      else if (tag === 2) city.name = r.string();
      else if (tag === 3) city.country = r.string();
      else if (tag === 7) city.featureCode = r.string();
      else if (tag === 9) city.population = r.varint();
      else if (tag === 10) {
        lastLon += r.svarint();
        city.lon = lastLon / 1e5;
      } else if (tag === 11) {
        lastLat += r.svarint();
        city.lat = lastLat / 1e5;
      } else r.skip(type);
    }
    cities.push(city);
  }
  return cities;
}

const sqlText = (value) => `'${value.replaceAll("'", "''")}'`;

async function main() {
  const source = process.argv[2];
  if (!source) {
    console.error("Usage : node scripts/generate-cities-sql.mjs chemin/vers/cities.pbf");
    process.exit(1);
  }
  const all = decodeCities(await readFile(source));
  const kept = all
    .filter((c) => c.population >= MIN_POPULATION || c.featureCode === "PPLC")
    .filter((c) => /^[A-Z]{2}$/.test(c.country) && c.name && Number.isFinite(c.lat) && Number.isFinite(c.lon))
    .sort((a, b) => a.id - b.id);

  const header = [
    "-- Lot 0 · Villes (données) : villes de plus de 15 000 habitants et capitales.",
    "-- FICHIER GÉNÉRÉ par scripts/generate-cities-sql.mjs : ne pas modifier à la main.",
    "-- Source : GeoNames (CC BY 4.0, https://www.geonames.org/), via le paquet npm",
    `-- all-the-cities@3.1.0. ${kept.length} villes sur ${all.length}.`,
    "",
  ];
  const batches = [];
  for (let i = 0; i < kept.length; i += BATCH) {
    const rows = kept.slice(i, i + BATCH).map(
      (c) =>
        `(${c.id},${sqlText(c.name)},'${c.country}',${c.population},${c.featureCode === "PPLC"},${c.lon},${c.lat})`,
    );
    batches.push(
      `insert into public.cities (id, name, country_iso2, population, is_capital, lng, lat) values\n${rows.join(",\n")};`,
    );
  }
  const footer = [
    "",
    "update public.cities",
    "set location = extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;",
    "",
    "analyze public.cities;",
    "",
  ];
  await writeFile(OUTPUT, [...header, ...batches, ...footer].join("\n"));
  console.log(`${kept.length} villes écrites dans ${OUTPUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
