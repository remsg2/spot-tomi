import { NextResponse } from "next/server";
import { BUILD_ID, getPublicEnvResult } from "@/lib/env/server";

/**
 * Contrôle de santé utilisé par la CI après chaque déploiement :
 * - buildId = le commit déployé ;
 * - appEnv et supabaseHost prouvent que la config vient bien du runtime ;
 * - schemaVersion prouve que les migrations sont appliquées au bon projet.
 */
export async function GET() {
  const result = await getPublicEnvResult();

  if (!result.ok) {
    return NextResponse.json(
      {
        status: "misconfigured",
        appEnv: result.appEnv,
        buildId: BUILD_ID,
        missing: result.missing,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const { appEnv, supabaseUrl, supabaseKey } = result.env;
  let schemaVersion: string | null = null;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/schema_version`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) schemaVersion = (await response.json()) as string;
  } catch {
    schemaVersion = null;
  }

  return NextResponse.json(
    {
      status: schemaVersion ? "ok" : "degraded",
      appEnv,
      buildId: BUILD_ID,
      supabaseHost: new URL(supabaseUrl).host,
      schemaVersion,
    },
    {
      status: schemaVersion ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
