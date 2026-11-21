/** URL publique d'un fichier d'un bucket Supabase Storage public. */
export function publicStorageUrl(supabaseUrl: string, bucket: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}
