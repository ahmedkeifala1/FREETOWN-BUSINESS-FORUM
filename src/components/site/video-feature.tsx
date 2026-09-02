'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { REDUCED_MOTION_QUERY, useMediaQuery } from '@/lib/use-media-query'

/**
 * A self-hosted video, played in the shape it was actually shot in (§4.14).
 *
 * The forum's clips come off a phone, portrait and already compressed. Letting
 * the frame be portrait is the honest answer: stretching a 360-wide vertical
 * video across a landscape box either pillarboxes it in black bars or crops the
 * heads off, and both look like a mistake rather than a decision.
 *
 * **Nothing is fetched until the panel is actually reached.** `preload="none"`
 * plus an IntersectionObserver that attaches the source on approach is what
 * keeps an autoplaying five-megabyte file off the bill of a visitor on a
 * handset who never scrolls this far (NFR-01). Autoplay is muted and
 * `playsInline`, without which iOS takes the video fullscreen unbidden.
 *
 * **Reduced motion is honoured by not autoplaying at all.** The rest of the
 * site answers that preference by stilling an animation (see `globals.css`);
 * a video cannot be stilled and still be a video, so it is offered with its
 * controls instead and the visitor decides. That also gives anyone who simply
 * wants the sound a way in, since an autoplaying video must be muted to be
 * allowed to start.
 *
 * Both browser facts below are read through `useSyncExternalStore` rather than
 * an effect that sets state. It is the same reason in each case: the value
 * exists outside React, the server cannot see it, and the server's assumption
 * has to be the one the first client render agrees with or hydration reports a
 * mismatch. The media query goes through `useMediaQuery`, which the hero
 * mosaic's video tiles share; observer support is not a media query and stays
 * here.
 */

/** Support never changes within a page's life, so there is nothing to notify. */
const subscribeToNothing = () => () => {}

const getObserverSupport = () => typeof IntersectionObserver !== 'undefined'

/** Assume support, so the server does not render the "load it now" fallback. */
const getObserverSupportOnServer = () => true

export function VideoFeature({
  src,
  poster,
  /** Describes the footage for anyone who cannot see it (NFR-09). */
  label,
  /**
   * Whether it starts itself. True for the homepage band, where the clip is
   * the point of the section; false in a listing, where several playing at
   * once would be a wall of competing movement and the visitor has come to
   * choose one.
   */
  autoplay: wantsAutoplay = true,
  className,
}: {
  src: string
  poster?: string | null
  label: string
  autoplay?: boolean
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Assume motion is welcome on the server. The markup is identical either
  // way — only whether the clip starts itself differs, and that is decided on
  // the client.
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY, false)

  const observerSupported = useSyncExternalStore(
    subscribeToNothing,
    getObserverSupport,
    getObserverSupportOnServer,
  )

  // Only ever set true, so a panel scrolled past and back does not start its
  // download again.
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const element = videoRef.current
    if (!element || inView || !observerSupported) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
          observer.disconnect()
        }
      },
      // A screen's worth of warning, so the first frame is ready by the time
      // the panel is actually looked at rather than starting as it arrives.
      { rootMargin: '100% 0px' },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [inView, observerSupported])

  // Without an observer there is no way to know when the panel is reached, so
  // the source is attached immediately. `preload="none"` means that still
  // costs nothing until something asks for the video: a wasted request is a
  // smaller failure than a player that never loads at all.
  const active = inView || !observerSupported

  const autoplay = wantsAutoplay && active && !reduceMotion

  return (
    <video
      ref={videoRef}
      // Keyed on the playback decision, so a change of mind remounts the
      // element rather than leaving the browser holding a source and a set of
      // attributes it has already committed to.
      key={autoplay ? 'auto' : 'manual'}
      src={active ? src : undefined}
      poster={poster ?? undefined}
      preload="none"
      autoPlay={autoplay}
      muted={autoplay}
      loop={autoplay}
      playsInline
      // Controls whenever it is not playing itself — the reduced-motion case,
      // a listing, and the moment before the source is attached.
      controls={!autoplay}
      aria-label={label}
      className={className}
    />
  )
}
