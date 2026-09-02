'use client'

import { REDUCED_MOTION_QUERY, useMediaQuery } from '@/lib/use-media-query'

/**
 * One of the forum's own clips, playing silently inside a hero mosaic tile.
 *
 * The wall is the secretariat's record of its engagements, and a still
 * photograph is only half of that record — the tiles that move are the ones
 * that show a room actually working. It sits in the positions the figure tiles
 * used to hold, so the composition's rhythm is unchanged.
 *
 * **It plays only where playing is worth the bytes.** Two conditions, both
 * read from the browser:
 *
 * - Reduced motion. The rest of the site answers that preference by stilling
 *   an animation (see `globals.css`, `.hero-mosaic-track`); the wall behind
 *   this tile stops dead, and a clip left running inside a stopped wall would
 *   be the only thing moving on the page.
 * - Viewport width. Below `lg` the mosaic is no longer the hero's right-hand
 *   panel but a block stacked under the call to action, and a handset on a 3G
 *   connection should not spend several megabytes on decoration it has to
 *   scroll past (NFR-01).
 *
 * When it is not playing the element stays in place with `preload="metadata"`,
 * which gets the browser the poster frame and nothing more. That is deliberate:
 * dropping the tile instead would open a hole in a grid whose whole job is to
 * be unbroken, and the first frame of a clip filmed in a meeting room is as
 * good a photograph as the ones beside it.
 *
 * No `controls`, ever. The mosaic is `aria-hidden` as a composition, and a
 * focusable player inside a hidden subtree is a trap for anyone tabbing
 * through the hero — the same clip is offered properly, with controls and a
 * caption, in the film band further down the page.
 */

/** Tailwind's `lg`, where the mosaic becomes the hero's right-hand panel. */
const WIDE_VIEWPORT_QUERY = '(min-width: 64rem)'

export function HeroMosaicVideo({
  src,
  poster,
  className,
}: {
  src: string
  poster?: string | null
  className?: string
}) {
  // Assume the desktop composition and assume motion is welcome, which is what
  // the server renders. Both are corrected on the client the moment it takes
  // over, and being wrong for that instant costs a poster frame at worst.
  const wideViewport = useMediaQuery(WIDE_VIEWPORT_QUERY, true)
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY, false)

  const playing = wideViewport && !reduceMotion

  return (
    <video
      // Keyed on the playback decision, so a change of mind remounts the
      // element rather than leaving the browser holding a set of attributes it
      // has already committed to — see the same note in `video-feature`.
      key={playing ? 'playing' : 'still'}
      src={src}
      poster={poster ?? undefined}
      preload={playing ? 'auto' : 'metadata'}
      autoPlay={playing}
      loop={playing}
      // Muted unconditionally: an autoplaying video is only allowed to start
      // if it is silent, and a wall of decoration has no business making noise
      // in either state.
      muted
      // Without this iOS takes the clip fullscreen the moment it starts.
      playsInline
      className={className}
    />
  )
}
