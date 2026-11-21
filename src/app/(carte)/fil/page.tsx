import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { LoadError } from "@/components/leaderboard/column-page";
import { isDemoPhoto } from "@/components/spot/spot-sheet";
import { LikeButton } from "@/components/spot/spot-client";
import { Sticker } from "@/components/ui";
import { tm } from "@/i18n/map.fr";
import { ts } from "@/i18n/stats.fr";
import { getSessionUser } from "@/lib/auth/server";
import { editionVisualUrl } from "@/lib/editions";
import { fetchFeed } from "@/lib/stats/queries";

export const metadata: Metadata = { title: ts.feed.title, description: ts.feed.metaDescription };

const PAGE = 20;

/**
 * Fil photo (cahier des charges V1.1, section 9.4) : les derniers stickers publiés, avec
 * photo, pseudo, lieu, date, édition et likes. ?avant=<date ISO> pour la page suivante.
 */
export default function FeedPage({ searchParams }: PageProps<"/fil">) {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-bg px-4 pt-5 pb-10 md:bg-card md:px-6 md:pt-0">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] leading-tight font-normal">{ts.feed.title}</h1>
        <p className="text-sm text-muted">{ts.feed.intro}</p>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[22px] bg-soft" aria-hidden="true" />}>
        <FeedContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FeedContent({ searchParams }: Pick<PageProps<"/fil">, "searchParams">) {
  const params = await searchParams;
  const rawBefore = typeof params.avant === "string" ? params.avant : null;
  const before = rawBefore && !Number.isNaN(Date.parse(rawBefore)) ? rawBefore : null;
  const [items, user] = await Promise.all([fetchFeed(before, PAGE), getSessionUser().catch(() => null)]);
  if (!items) return <LoadError message={ts.feed.error} />;
  if (items.length === 0) return <p className="text-sm text-muted">{ts.feed.empty}</p>;

  const last = items[items.length - 1];
  return (
    <>
      <ol className="flex flex-col gap-4" data-testid="feed">
        {items.map((item) => (
          <li key={item.id}>
            <article
              className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-card"
              style={{ "--year": item.color } as CSSProperties}
            >
              <Link href={`/spots/${item.id}`} className="relative block aspect-[4/3] bg-soft">
                {isDemoPhoto(item.photoUrl) ? (
                  <span className="flex h-full items-center justify-center">
                    {editionVisualUrl(item.year, null, null) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={editionVisualUrl(item.year, null, null) ?? ""}
                        alt={tm.spot.photoAlt(item.name)}
                        width={150}
                        height={150}
                        loading="lazy"
                        className="size-[150px] -rotate-6 rounded-[12px] shadow-card-lg"
                      />
                    ) : (
                      <Sticker size={110} tilt={-7} label={tm.spot.photoAlt(item.name)} />
                    )}
                  </span>
                ) : (
                  // Miniature (480 px) si elle existe, sinon la photo.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbUrl ?? item.photoUrl}
                    alt={tm.spot.photoAlt(item.name)}
                    loading="lazy"
                    width={480}
                    height={360}
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute top-3 left-3 rounded-[6px] bg-year px-2 py-1 text-[11px] font-extrabold text-on-year">
                  {tm.spot.edition(item.editionName, item.year)}
                </span>
              </Link>
              <div className="flex flex-col gap-2 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <Link href={`/spots/${item.id}`} className="truncate font-display text-lg leading-tight">
                      {item.name}
                    </Link>
                    <span className="truncate text-xs text-muted">
                      {[tm.spot.place(item.city, item.countryName), ts.shortDate(item.pastedAt)].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="shrink-0 font-display text-base">{`${ts.number(item.points)} pts`}</span>
                </div>
                <Link href={`/u/${item.authorUsername}`} className="self-start text-sm font-bold">
                  {ts.feed.by(item.authorUsername)}
                </Link>
                {item.comment && <p className="text-sm leading-snug break-words">{item.comment}</p>}
                <LikeButton id={item.id} initialCount={item.likeCount} initialLiked={item.liked} canLike={user !== null} />
              </div>
            </article>
          </li>
        ))}
      </ol>
      {items.length === PAGE && (
        <Link
          href={`/fil?avant=${encodeURIComponent(last.createdAt)}`}
          className="inline-flex min-h-11 items-center self-center rounded-full bg-soft px-5 text-sm font-semibold"
        >
          {ts.feed.more}
        </Link>
      )}
    </>
  );
}
