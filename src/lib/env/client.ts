"use client";

import {
  RUNTIME_ENV_ELEMENT_ID,
  type PublicEnv,
  type PublicEnvResult,
} from "./schema";

let cached: PublicEnvResult | undefined;

/** Lit la configuration injectée par <RuntimeEnv /> dans le HTML. */
export function getClientEnvResult(): PublicEnvResult {
  if (cached) return cached;
  const element =
    typeof document === "undefined"
      ? null
      : document.getElementById(RUNTIME_ENV_ELEMENT_ID);
  if (!element?.textContent) {
    throw new Error(
      "Configuration d'exécution absente : <RuntimeEnv /> doit être rendu dans le layout racine.",
    );
  }
  cached = JSON.parse(element.textContent) as PublicEnvResult;
  return cached;
}

export function getClientEnv(): PublicEnv {
  const result = getClientEnvResult();
  if (!result.ok) {
    throw new Error(`Configuration incomplète : ${result.missing.join(", ")}`);
  }
  return result.env;
}
