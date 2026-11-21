import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Fonctions Edge : code Deno, hors du projet Next.
    "supabase/functions/**",
    // Copies de travail des agents (git worktrees).
    ".claude/**",
    // Fichiers générés au build (worker MapLibre copié, service worker Serwist).
    "public/vendor/**",
    "public/sw.js",
  ]),
]);

export default eslintConfig;
