import { z } from "zod";

/**
 * Configuration propre à chaque environnement (local, staging, production).
 *
 * Ces valeurs ne sont JAMAIS lues au moment du build : la même build est
 * promue de staging à production. Elles sont lues au runtime côté serveur,
 * puis transmises au navigateur par le layout racine (voir RuntimeEnv).
 */
export const APP_ENVS = ["local", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  APP_ENV: z.enum(APP_ENVS).default("local"),
});

/** Ce que le navigateur a le droit de connaître. Jamais de clé secrète ici. */
export type PublicEnv = {
  appEnv: AppEnv;
  supabaseUrl: string;
  supabaseKey: string;
};

export type PublicEnvResult =
  | { ok: true; env: PublicEnv }
  | { ok: false; appEnv: AppEnv; missing: string[] };

type EnvSource = Record<string, string | undefined>;

/** Lit et valide la configuration publique depuis une source (process.env en pratique). */
export function parsePublicEnv(source: EnvSource): PublicEnvResult {
  const parsed = serverEnvSchema.safeParse({
    SUPABASE_URL: source.SUPABASE_URL,
    // Nouvelle clé « publishable » de Supabase, ou ancienne clé anon en repli.
    SUPABASE_PUBLISHABLE_KEY:
      source.SUPABASE_PUBLISHABLE_KEY ?? source.SUPABASE_ANON_KEY,
    APP_ENV: source.APP_ENV || undefined,
  });

  if (!parsed.success) {
    const appEnv = z.enum(APP_ENVS).catch("local").parse(source.APP_ENV);
    const missing = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ];
    return { ok: false, appEnv, missing };
  }

  return {
    ok: true,
    env: {
      appEnv: parsed.data.APP_ENV,
      supabaseUrl: parsed.data.SUPABASE_URL.replace(/\/+$/, ""),
      supabaseKey: parsed.data.SUPABASE_PUBLISHABLE_KEY,
    },
  };
}

/** Sérialise pour un <script type="application/json"> sans risque d'injection HTML. */
export function serializePublicEnv(result: PublicEnvResult): string {
  return JSON.stringify(result)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export const RUNTIME_ENV_ELEMENT_ID = "spot-tomi-runtime-env";
