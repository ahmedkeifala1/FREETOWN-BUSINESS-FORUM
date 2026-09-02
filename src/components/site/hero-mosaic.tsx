import { HeroMosaicVideo } from '@/components/site/hero-mosaic-video'
import { Icon } from '@/components/ui/icon'
import { initials } from '@/lib/format'

/**
 * The hero's right half: a mosaic of the forum's own photographs and clips
 * that runs off the bottom and right edges of the viewport, creeping upwards
 * on a slow loop.
 *
 * Four kinds of tile, interleaved. Photographs from the forum gallery are the
 * bulk of it, and video tiles are set among them so the wall carries some
 * movement of the forum's own rather than only travelling. Flat brand-coloured
 * tiles carry one figure each and are used where a page has a number worth
 * stating inside the fold; the homepage no longer does, because it states the
 * same figures properly in the stats band directly beneath the hero. Logo
 * tiles are for the membership hero, where the wall is member organisations
 * rather than the forum's own record — a member with no logo on file falls
 * back to its initials on brand colour, the same as the directory does,
 * because a grid of broken-image icons would be the first thing a visitor
 * sees.
 *
 * The photographs and the clips are the secretariat's own record of its
 * engagements — delegations, embassies, working sessions — which is what §3.4
 * means by authentic Sierra Leonean photography. They arrive from the
 * `forum-gallery` and `forum-videos` media collections, so the wall is
 * reordered by editing `sortOrder`, not by changing this file.
 *
 * Tiles are square and the grid is three columns, except at the two positions
 * below, where a photograph is given four cells. A wall of identical squares
 * reads as a contact sheet; the reference composition breaks it up, and one
 * large tile near the top with a second at the fold is what carries that
 * rhythm without needing a bespoke layout per tile count. `grid-flow-row-dense`
 * backfills the cells a large tile skips, so no holes open up beside it.
 *
 * The movement is why the grid is rendered twice. A wall that scrolled a
 * single copy would run out and leave the panel empty; a second copy directly
 * beneath it means the animation can travel exactly one wall's height and
 * restart with the picture unchanged, so the loop has no visible seam and no
 * end. The duplication is free to a reader — the whole block is
 * `aria-hidden` — and close to free to the browser, since the second copy
 * requests the same files the first one already holds, video included. Both
 * the travel and the reduced-motion behaviour live in `globals.css` under
 * `.hero-mosaic-track`.
 */

export type MosaicTile =
  | { kind: 'photo'; id: string; url: string }
  | { kind: 'video'; id: string; url: string; posterUrl: string | null }
  | { kind: 'logo'; id: string; name: string; logoUrl: string | null }
  | { kind: 'figure'; id: string; icon: string; value: string; label: string }

const FIGURE_TONES = [
  'bg-gold-500 text-gold-950',
  'bg-forest-600 text-white',
  'bg-harbour-600 text-white',
]

/**
 * Which tiles take four cells instead of one.
 *
 * Both are photograph positions under the interleaving in `buildMosaic` — a
 * clip at four cells stops being texture and starts competing with the
 * headline beside it — and a tile that is not a photograph simply stays
 * square, so the two files need not agree for the layout to hold.
 */
const FEATURE_POSITIONS = [1, 6]

/** How many tiles load eagerly — roughly the first row, which is above the fold. */
const EAGER_TILES = 3

export function HeroMosaic({ tiles }: { tiles: MosaicTile[] }) {
  if (tiles.length === 0) return null

  // Each figure tile takes the next tone in rotation. Derived from its
  // position among the figures rather than a counter incremented inside the
  // map — mutating a variable while rendering is what the React compiler
  // rightly objects to, and there are at most three of these to scan.
  const figureIds = tiles
    .filter((tile) => tile.kind === 'figure')
    .map((tile) => tile.id)

  return (
    // Decorative as a composition. The figures all repeat in the stats strip
    // below, and the photographs and clips state nothing the page does not say
    // in words — so hiding the block loses no information, and spares a screen
    // reader a dozen unlabelled tiles before the first heading.
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* The travelling track. Flex with no gap of its own: the spacing
          between the two copies is the bottom padding each one carries, which
          is what keeps a lap exactly one wall long. */}
      <div className="hero-mosaic-track flex flex-col">
        <MosaicGrid tiles={tiles} figureIds={figureIds} eager />
        <MosaicGrid tiles={tiles} figureIds={figureIds} />
      </div>
    </div>
  )
}

/**
 * One copy of the wall.
 *
 * `eager` belongs to the first copy alone. The second is a duplicate of what
 * is already on screen and must never compete with the real thing for the
 * connection on a handset (NFR-01).
 *
 * The bottom padding matches the grid gap so the two copies meet at the same
 * rhythm as the rows inside them, and — see `globals.css` — so that half the
 * track is exactly one copy.
 */
function MosaicGrid({
  tiles,
  figureIds,
  eager = false,
}: {
  tiles: MosaicTile[]
  figureIds: string[]
  eager?: boolean
}) {
  return (
    <div className="grid grid-flow-row-dense grid-cols-3 gap-1.5 pb-1.5">
      {tiles.map((tile, index) => {
        if (tile.kind === 'figure') {
          const tone =
            FIGURE_TONES[figureIds.indexOf(tile.id) % FIGURE_TONES.length]

          return (
            <div
              key={tile.id}
              className={`flex aspect-square flex-col justify-between p-3 sm:p-4 ${tone}`}
            >
              <Icon name={tile.icon} className="size-6 opacity-80 sm:size-7" />
              <div>
                <p className="font-display text-2xl font-extrabold leading-none sm:text-3xl">
                  {tile.value}
                </p>
                <p className="mt-1 text-[0.6875rem] font-semibold uppercase leading-tight tracking-wide opacity-85">
                  {tile.label}
                </p>
              </div>
            </div>
          )
        }

        if (tile.kind === 'video') {
          return (
            <div key={tile.id} className="aspect-square bg-ink-900">
              {/* Cropped to the square like every other tile. The forum's
                  clips are portrait, filmed on a phone, and the film band
                  further down the page is where they are shown in the shape
                  they were shot in — here they are texture, and a tile that
                  broke the grid to keep its aspect ratio would cost the
                  composition more than the crop does. */}
              <HeroMosaicVideo
                src={tile.url}
                poster={tile.posterUrl}
                className="size-full object-cover"
              />
            </div>
          )
        }

        if (tile.kind === 'logo') {
          return (
            <div key={tile.id} className="aspect-square bg-ink-900">
              {tile.logoUrl ? (
                // Remote CMS URL — see the note in ui/card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.logoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center font-display text-3xl font-extrabold text-white/20 sm:text-4xl">
                  {initials(tile.name)}
                </span>
              )}
            </div>
          )
        }

        const feature = FEATURE_POSITIONS.includes(index)

        return (
          <div
            key={tile.id}
            className={`aspect-square bg-ink-900 ${feature ? 'col-span-2 row-span-2' : ''}`}
          >
            {/* Local file under `public/brand/hero/`, already squared and
                sized for a tile — see the seed. Plain `<img>` because the
                URL comes from the database, where a later upload may be a
                remote one; see the note in ui/card.tsx. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tile.url}
              alt=""
              loading={eager && index < EAGER_TILES ? 'eager' : 'lazy'}
              decoding="async"
              className="size-full object-cover"
            />
          </div>
        )
      })}
    </div>
  )
}
