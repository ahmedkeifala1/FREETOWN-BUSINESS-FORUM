import { Icon } from '@/components/ui/icon'
import { initials } from '@/lib/format'

/**
 * The hero's right half: a three-column mosaic of square tiles that runs off
 * the bottom and right edges of the viewport.
 *
 * Two kinds of tile, interleaved — speaker portraits, and flat brand-coloured
 * tiles carrying one figure each. The flat tiles are not filler: they hold the
 * numbers the forum is selling (delegates, countries, sectors), so the block
 * earns its half of the fold rather than only decorating it.
 *
 * Speakers with no photograph fall back to an initials tile on brand colour,
 * the same as the speaker wall further down. That matters more than usual
 * here: the mosaic is the first thing on the page, and a grid of broken-image
 * icons would be the first impression.
 */

export type MosaicTile =
  | { kind: 'speaker'; id: string; name: string; photoUrl: string | null }
  | { kind: 'figure'; id: string; icon: string; value: string; label: string }

const FIGURE_TONES = [
  'bg-gold-500 text-gold-950',
  'bg-forest-600 text-white',
  'bg-harbour-600 text-white',
]

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
    // Decorative as a composition — every speaker here is also a real link in
    // the speaker wall below, and every figure repeats in the stats strip, so
    // hiding it from assistive technology loses nothing and spares a screen
    // reader a dozen unlabelled tiles before the first heading.
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div className="grid grid-cols-3 gap-1.5">
        {tiles.map((tile) => {
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

          return (
            <div key={tile.id} className="aspect-square bg-ink-900">
              {tile.photoUrl ? (
                // Remote CMS URL — see the note in ui/card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.photoUrl}
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
        })}
      </div>
    </div>
  )
}
