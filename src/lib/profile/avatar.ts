import { publicStorageUrl } from "@/lib/storage";

/**
 * URL publique d'un avatar (bucket « avatars », lecture publique, étape 3),
 * ou null sans avatar. L'URL Supabase n'est connue qu'au runtime : côté serveur.
 */
export function avatarPublicUrl(supabaseUrl: string, path: string | null | undefined): string | null {
  return path ? publicStorageUrl(supabaseUrl, "avatars", path) : null;
}
