/**
 * Fournisseurs de connexion externes affichés sur /login.
 * Google et Apple sont prêts dans le code mais désactivés tant qu'ils ne sont
 * pas configurés dans Supabase (Authentication → Sign In / Providers).
 * Pour en activer un : l'ajouter à cette liste.
 */
export type OAuthProvider = "google" | "apple";

export const ENABLED_OAUTH_PROVIDERS: readonly OAuthProvider[] = [];
