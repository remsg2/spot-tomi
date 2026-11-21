import Link from "next/link";
import type { CSSProperties } from "react";
import { BackLink, PointsBlock, PointsBreakdown, Sticker } from "@/components/ui";
import { tm } from "@/i18n/map.fr";
import { rulesFr } from "@/i18n/rules.fr";
import type { SpotPageData } from "@/lib/spots/server";
import { AuthorActions, ReportForm, ShareButton, SpotFocus } from "./spot-client";

const chip = "rounded-[6px] px-2 py-1 text-[11px] text-on-year";

/** Photos des stickers de démo (supabase/seed.sql) : fichiers « {auteur}/demo-{uuid}.webp » inexistants. */
export function isDemoPhoto(url: string): boolean {
  return /\/demo-[0-9a-f-]{36}\.webp$/i.test(url);
}

/**
 * Fiche lieu (maquettes Fiche et Web) : photo, nom, lieu, auteur, date, badges,
 * bloc de points et détail ligne par ligne. Toute la fiche prend la couleur de
 * l'année du sticker (--year), pas celle de l'année en cours.
 */
export function SpotSheet({
  spot,
  viewerId,
}: {
  spot: SpotPageData;
  /** Utilisateur connecté (null : visiteur). */
  viewerId: string | null;
}) {
  const pending = spot.status !== "published";
  const isAuthor = viewerId !== null && viewerId === spot.authorId;
  const tier = spot.countryTier ? (tm.spot.tier[spot.countryTier] ?? null) : null;
  const place = tm.spot.place(spot.city, spot.countryName);

  return (
    <article
      data-testid="spot-sheet"
      className="relative flex flex-1 flex-col bg-card md:pb-6"
      style={{ "--year": spot.color } as CSSProperties}
    >
      <SpotFocus id={spot.id} lng={spot.lng} lat={spot.lat} />

      {/* Sur mobile, la photo sert aussi de poignée au tiroir (src/components/shell/spot-drawer.tsx). */}
      <div
        data-sheet-grip=""
        className="relative h-[270px] shrink-0 touch-none overflow-hidden bg-soft select-none md:mx-6 md:h-[168px] md:touch-auto md:rounded-[18px] md:select-auto"
      >
        {isDemoPhoto(spot.photoUrl) ? (
          // Stickers de démo (base dev) : pas de vraie photo, le sticker en illustration.
          <div className="flex h-full items-center justify-center">
            <Sticker size={134} tilt={-7} label={tm.spot.photoAlt(spot.name)} />
          </div>
        ) : (
          <>
            {/* Photo publique du bucket spot-photos (WebP sans EXIF), servie par Supabase. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={spot.photoUrl}
              alt={tm.spot.photoAlt(spot.name)}
              width={1024}
              height={768}
              fetchPriority="high"
              className="h-full w-full object-cover"
            />
          </>
        )}
        <div className="absolute inset-x-4 top-[calc(16px+env(safe-area-inset-top))] flex justify-between md:inset-x-3 md:top-3 md:justify-end">
          <BackLink href="/" label={tm.spot.close} icon="close" variant="floating" className="md:hidden" />
          <ShareButton name={spot.name} />
        </div>
      </div>

      <div className="relative -mt-[26px] flex flex-col gap-3.5 rounded-t-[26px] bg-card px-4 pt-5 pb-8 md:mt-0 md:rounded-none md:px-6 md:pt-4 md:pb-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${chip} bg-year font-extrabold`}>{spot.year}</span>
          {spot.isFirstInCountry && <span className={`${chip} bg-gold font-bold`}>{tm.spot.badges.firstInCountry}</span>}
          {spot.isExceptional && (
            <span className={`${chip} bg-gold font-bold`}>
              {tm.spot.badges.exceptional}
              {spot.altitude ? ` · ${tm.spot.altitude(spot.altitude)}` : ""}
            </span>
          )}
          {pending && (
            <span className="rounded-[6px] border border-dashed border-dash px-2 py-[3px] text-[11px] font-bold text-muted">
              {tm.spot.badges.pending}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[32px] leading-none font-normal break-words md:text-[30px] md:leading-[1.05]">
            {spot.name}
          </h1>
          {place && <p className="text-sm text-muted">{place}</p>}
        </div>

        <div className="flex items-center gap-2.5">
          {spot.authorAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={spot.authorAvatarUrl}
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-full object-cover shadow-[0_0_0_2px_var(--year)]"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-band text-[13px] font-extrabold text-white shadow-[0_0_0_2px_var(--year)]"
            >
              {spot.authorUsername.charAt(0).toUpperCase()}
            </span>
          )}
          <Link href={`/u/${spot.authorUsername}`} className="text-sm font-bold">
            {spot.authorUsername}
          </Link>
          <time dateTime={spot.takenAt} className="text-[13px] text-muted">
            {tm.spot.date(spot.takenAt)}
          </time>
        </div>

        <PointsBlock
          points={spot.points}
          pending={pending}
          eyebrow={tm.spot.rarity}
          label={tier ? (spot.isFirstInCountry ? tm.spot.tierFirst(tier) : tier) : undefined}
          className="md:h-[112px] md:rounded-[18px]"
        />
        {pending && <p className="text-sm text-muted">{tm.spot.pendingNote}</p>}

        {spot.lines.length > 0 ? (
          <PointsBreakdown lines={spot.lines} />
        ) : (
          <p className="text-sm text-muted">{tm.spot.noLines}</p>
        )}
        <Link href="/points" className="-mt-1 inline-flex min-h-11 items-center self-start text-sm font-semibold underline underline-offset-4">
          {rulesFr.link}
        </Link>

        {isAuthor ? <AuthorActions id={spot.id} name={spot.name} /> : viewerId && <ReportForm id={spot.id} />}
      </div>
    </article>
  );
}

/** Squelette de la fiche pendant le chargement. */
export function SpotSheetSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-1 flex-col bg-card md:pb-6">
      <div className="h-[270px] animate-pulse bg-soft md:mx-6 md:h-[168px] md:rounded-[18px]" />
      <div className="flex flex-col gap-3.5 px-4 pt-5 md:px-6">
        <div className="h-5 w-24 animate-pulse rounded-[6px] bg-soft" />
        <div className="h-8 w-2/3 animate-pulse rounded-[8px] bg-soft" />
        <div className="h-[132px] animate-pulse rounded-[20px] bg-soft md:h-[112px]" />
      </div>
    </div>
  );
}
