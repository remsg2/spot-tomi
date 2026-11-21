import "server-only";
import { connection } from "next/server";
import { parsePublicEnv, type PublicEnvResult } from "./schema";

/**
 * Lit la configuration au moment de la requête, jamais au build.
 * `connection()` force le rendu dynamique : sans lui, Next.js pourrait
 * pré-rendre la valeur pendant le build et la figer dans la sortie.
 */
export async function getPublicEnvResult(): Promise<PublicEnvResult> {
  await connection();
  return parsePublicEnv(process.env);
}

/** Variante stricte : lève une erreur si la configuration est incomplète. */
export async function getPublicEnv() {
  const result = await getPublicEnvResult();
  if (!result.ok) {
    throw new Error(
      `Configuration incomplète (${result.appEnv}) : ${result.missing.join(", ")}`,
    );
  }
  return result.env;
}

/** Identifiant de la build (le commit), gravé au build exprès : la CI vérifie le déploiement avec. */
export const BUILD_ID = process.env.SPOT_TOMI_BUILD_ID ?? "dev";
