import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isSpotId } from "@/components/shell/routes";
import { SpotSheet, SpotSheetSkeleton } from "@/components/spot/spot-sheet";
import { tm } from "@/i18n/map.fr";
import { formatPoints } from "@/lib/design/points";
import { toEditionOptions } from "@/lib/editions";
import { DEFAULT_COMMENT_MAX } from "@/lib/publish/contract";
import { getLikeInfo, getNearbySpots, getSpotEditInfo, getSpotPageData, getViewer } from "@/lib/spots/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function loadSpot(id: string) {
  if (!isSpotId(id)) return null;
  try {
    return await getSpotPageData(id.toLowerCase());
  } catch {
    return null;
  }
}

/** Métadonnées Open Graph : partage d'une fiche par lien (spécifications 2.4). */
export async function generateMetadata({ params }: PageProps<"/spots/[id]">): Promise<Metadata> {
  const { id } = await params;
  const spot = await loadSpot(id);
  if (!spot) return { title: tm.spot.notFoundTitle, robots: { index: false } };

  const place = tm.spot.place(spot.city, spot.countryName);
  const description = tm.spot.metaDescription(
    place,
    spot.authorUsername,
    spot.status === "published" ? `+${formatPoints(spot.points)}` : "…",
  );
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const url = host ? `${protocol}://${host}/spots/${spot.id}` : undefined;

  return {
    title: spot.name,
    description,
    alternates: url ? { canonical: url } : undefined,
    robots: spot.status === "published" ? undefined : { index: false },
    openGraph: {
      type: "article",
      title: spot.name,
      description,
      url,
      locale: "fr_FR",
      images: [{ url: spot.photoUrl, alt: tm.spot.photoAlt(spot.name) }],
    },
    twitter: { card: "summary_large_image", title: spot.name, description, images: [spot.photoUrl] },
  };
}

export default function SpotPage({ params }: PageProps<"/spots/[id]">) {
  return (
    <Suspense fallback={<SpotSheetSkeleton />}>
      <SpotContent params={params} />
    </Suspense>
  );
}

async function SpotContent({ params }: Pick<PageProps<"/spots/[id]">, "params">) {
  const { id } = await params;
  const spot = await loadSpot(id);
  if (!spot) notFound();
  const { user } = await getViewer();
  const isAuthor = user?.id === spot.authorId;
  const published = spot.status === "published";
  const [like, nearby, editInfo, edit] = await Promise.all([
    published ? getLikeInfo(spot.id) : Promise.resolve({ count: 0, liked: false }),
    published ? getNearbySpots(spot.id) : Promise.resolve([]),
    isAuthor ? getSpotEditInfo(spot.id) : Promise.resolve(null),
    isAuthor ? loadEditOptions() : Promise.resolve({ editions: [], commentMax: DEFAULT_COMMENT_MAX }),
  ]);
  return (
    <SpotSheet
      spot={spot}
      viewerId={user?.id ?? null}
      extras={{ like, nearby, editInfo, editions: edit.editions, commentMax: edit.commentMax }}
    />
  );
}

/** Éditions choisissables et longueur du commentaire, pour le formulaire de l'auteur. */
async function loadEditOptions() {
  try {
    const supabase = await getSupabaseServerClient();
    const [editions, rule] = await Promise.all([
      supabase.rpc("list_editions"),
      supabase.from("scoring_rules").select("value").eq("key", "comment_max_length").maybeSingle<{ value: number }>(),
    ]);
    const commentMax = Number(rule.data?.value);
    return {
      editions: toEditionOptions(editions.data),
      commentMax: Number.isFinite(commentMax) && commentMax > 0 ? commentMax : DEFAULT_COMMENT_MAX,
    };
  } catch {
    return { editions: [], commentMax: DEFAULT_COMMENT_MAX };
  }
}
