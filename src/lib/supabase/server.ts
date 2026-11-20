import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env/server";

/** Client Supabase côté serveur, lié aux cookies de session de la requête. */
export async function getSupabaseServerClient() {
  const { supabaseUrl, supabaseKey } = await getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appelé depuis un Server Component : les cookies sont en lecture seule.
          // Le rafraîchissement de session sera assuré par proxy.ts (étape 3).
        }
      },
    },
  });
}
