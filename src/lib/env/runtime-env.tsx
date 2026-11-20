import { RUNTIME_ENV_ELEMENT_ID, serializePublicEnv } from "./schema";
import { getPublicEnvResult } from "./server";

/**
 * Transmet la configuration d'exécution au navigateur, sous forme de JSON
 * inerte dans le HTML. Le bundle JS n'en contient aucune valeur.
 * À placer dans un <Suspense> : ce composant dépend de la requête.
 */
export async function RuntimeEnv() {
  const result = await getPublicEnvResult();
  return (
    <script
      id={RUNTIME_ENV_ELEMENT_ID}
      type="application/json"
      // JSON échappé par serializePublicEnv : aucun HTML ne peut s'en échapper.
      dangerouslySetInnerHTML={{ __html: serializePublicEnv(result) }}
    />
  );
}
