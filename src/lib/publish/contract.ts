/**
 * Contrat de publication partagé avec l'Edge Function publish-spot : un seul
 * fichier source, dans supabase/functions/_shared (importable par Deno).
 */
export * from "../../../supabase/functions/_shared/publish-contract";
export {
  inspectWebp,
  isCleanWebp,
  stripWebpMetadata,
  type WebpInspection,
} from "../../../supabase/functions/_shared/webp-metadata";
