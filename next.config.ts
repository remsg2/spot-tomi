import type { NextConfig } from "next";

/**
 * Identifiant de build : le commit construit en CI, sinon « local ».
 * C'est la seule valeur gravée volontairement au build, puisqu'elle
 * identifie la build elle-même. Aucune valeur propre à un environnement
 * (URL Supabase, clés…) ne doit être lue ici : voir src/lib/env.
 */
const buildId =
  process.env.GITHUB_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Icônes rendues à la demande dans la couleur de l'année (src/lib/icons/app-icon.ts) :
  // les images de Tomi doivent accompagner ces fonctions serveur.
  outputFileTracingIncludes: {
    "/icons/*": ["./public/tomi/tomi.png", "./public/tomi/tomi-head.png"],
    "/favicon.ico": ["./public/tomi/tomi-head.png"],
  },
  generateBuildId: async () => buildId,
  env: {
    SPOT_TOMI_BUILD_ID: buildId,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
