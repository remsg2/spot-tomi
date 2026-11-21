import { AlbumTile } from "@/components/ui";
import { profileFr as p } from "@/i18n/profile.fr";
import { formatPoints } from "@/lib/design/points";
import type { AlbumView } from "@/lib/profile/album";

/**
 * Album : une tuile par pays conquis, couleur de l'année du premier sticker
 * dans ce pays ; tuiles en pointillés pour quelques pays à conquérir.
 * L'ancre #album sert à l'onglet « Album » de la barre d'onglets.
 */
export function AlbumSection({ album, isMe }: { album: AlbumView; isMe: boolean }) {
  return (
    <section id="album" aria-labelledby="album-title" className="flex scroll-mt-4 flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="album-title" className="font-display text-lg font-normal">
          {p.album.title}
        </h2>
        {album.legend.length > 0 && (
          <ul aria-label={p.album.legend} className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-1 text-[11px] font-semibold text-muted">
            {album.legend.map((item) => (
              <li key={item.year} className="flex items-center gap-1" data-legend-year={item.year}>
                <span aria-hidden="true" className="size-[9px] rounded-[2px]" style={{ background: item.color }} />
                <span aria-hidden="true">{item.short}</span>
                <span className="sr-only">{item.year}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {album.conquered.length === 0 && (
        <p className="text-sm text-muted">{isMe ? p.album.emptyMe : p.album.emptyOther}</p>
      )}

      <ul data-album-grid="" className="grid grid-cols-4 gap-[9px]">
        {album.conquered.map((tile) => (
          <li key={tile.iso2} data-album-tile="conquered">
            <AlbumTile
              code={tile.iso3}
              color={tile.color}
              points={tile.points}
              gold={tile.gold}
              tilt={tile.tilt}
              label={p.album.conqueredLabel(tile.nameFr, formatPoints(tile.points), tile.year, tile.gold)}
            />
          </li>
        ))}
        {album.toConquer.map((tile) => (
          <li key={tile.iso2} data-album-tile="locked">
            <AlbumTile
              variant="locked"
              code={tile.iso3}
              points={tile.points}
              label={p.album.lockedLabel(tile.nameFr, tile.points)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
