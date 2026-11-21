import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isSpotId } from "@/components/shell/routes";
import { SpotSheet, SpotSheetSkeleton } from "@/components/spot/spot-sheet";
import { tm } from "@/i18n/map.fr";
import { formatPoints } from "@/lib/design/points";
import { getSpotPageData, getViewer } from "@/lib/spots/server";

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
  return <SpotSheet spot={spot} viewerId={user?.id ?? null} />;
}
