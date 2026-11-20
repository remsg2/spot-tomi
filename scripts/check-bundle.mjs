#!/usr/bin/env node
/**
 * Vérifie qu'aucune URL ou clé Supabase n'est gravée dans les fichiers
 * envoyés au navigateur. Une build qui en contient ne peut pas être
 * promue de staging à production.
 *
 * Usage : node scripts/check-bundle.mjs [dossier...]
 * Par défaut : .next/static et .vercel/output/static (s'ils existent).
 * Les valeurs de SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY présentes dans
 * l'environnement sont aussi recherchées telles quelles.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SCANNED_EXTENSIONS = /\.(m?js|cjs|json|map|html|css|txt)$/;

export const FORBIDDEN_PATTERNS = [
  { name: "URL de projet Supabase", regex: /[a-z0-9-]{10,}\.supabase\.(co|in)/i },
  { name: "Supabase local", regex: /(127\.0\.0\.1|localhost):5432[1-9]/ },
  { name: "Clé publishable Supabase", regex: /sb_publishable_[A-Za-z0-9_-]{10,}/ },
  { name: "Clé secrète Supabase", regex: /sb_secret_[A-Za-z0-9_-]{10,}/ },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.isFile()) yield path;
  }
}

/** Renvoie la liste des fuites trouvées dans les dossiers donnés. */
export function scanDirectories(dirs, extraNeedles = []) {
  const needles = extraNeedles.filter((value) => value && value.length >= 8);
  const findings = [];
  let scanned = 0;

  for (const dir of dirs) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const file of walk(dir)) {
      if (!SCANNED_EXTENSIONS.test(file)) continue;
      scanned += 1;
      const content = readFileSync(file, "utf8");
      for (const { name, regex } of FORBIDDEN_PATTERNS) {
        const match = content.match(regex);
        if (match) findings.push({ file, rule: name, match: match[0] });
      }
      for (const needle of needles) {
        if (content.includes(needle)) {
          findings.push({ file, rule: "Valeur d'environnement", match: "(masquée)" });
        }
      }
    }
  }
  return { scanned, findings };
}

function main() {
  const args = process.argv.slice(2);
  const dirs = args.length > 0 ? args : [".next/static", ".vercel/output/static"];
  const existing = dirs.filter((dir) => existsSync(dir));
  if (existing.length === 0) {
    console.error(`Aucun dossier de build trouvé parmi : ${dirs.join(", ")}`);
    process.exit(2);
  }

  const extra = [
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_URL && new URL(process.env.SUPABASE_URL).host,
  ];
  const { scanned, findings } = scanDirectories(existing, extra);

  if (scanned === 0) {
    console.error("Aucun fichier analysé : la build est-elle vide ?");
    process.exit(2);
  }
  if (findings.length > 0) {
    console.error("Valeurs Supabase trouvées dans le bundle client :");
    for (const finding of findings) {
      console.error(`  ${relative(process.cwd(), finding.file)} · ${finding.rule} · ${finding.match}`);
    }
    process.exit(1);
  }
  console.log(`Bundle client propre : ${scanned} fichiers analysés dans ${existing.join(", ")}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
