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
