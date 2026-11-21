import { ICON_CACHE_CONTROL, renderFavicon } from "@/lib/icons/app-icon";
import { getCurrentYearColor } from "@/lib/season";

/** favicon.ico dans la couleur de l'année en cours (tête de Tomi, 16, 32 et 48 px). */
export async function GET() {
  const icon = await renderFavicon(await getCurrentYearColor());
  return new Response(new Uint8Array(icon), {
    headers: { "content-type": "image/x-icon", "cache-control": ICON_CACHE_CONTROL },
  });
}
