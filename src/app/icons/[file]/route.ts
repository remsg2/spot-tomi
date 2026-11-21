import { ICON_CACHE_CONTROL, isIconFile, renderIcon } from "@/lib/icons/app-icon";
import { getCurrentYearColor } from "@/lib/season";

/** Icônes de l'app (manifeste, iOS, favicon PNG) dans la couleur de l'année en cours. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!isIconFile(file)) return new Response("Icône inconnue", { status: 404 });
  const png = await renderIcon(file, await getCurrentYearColor());
  return new Response(new Uint8Array(png), {
    headers: { "content-type": "image/png", "cache-control": ICON_CACHE_CONTROL },
  });
}
