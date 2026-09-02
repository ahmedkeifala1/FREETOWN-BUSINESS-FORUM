'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Read a CSS media query from React.
 *
 * Two components need this — the film band and the hero mosaic's video tiles
 * — and both need it for the same reason: whether a clip is allowed to start
 * itself is a browser fact, not a database one, so the decision cannot be made
 * where the markup is built.
 *
 * `useSyncExternalStore` rather than an effect that sets state. The value
 * lives outside React, the server cannot see it, and the server's assumption
 * has to be the one the first client render agrees with or hydration reports a
 * mismatch — `serverValue` is that assumption, and React re-renders with the
 * real answer as soon as the tree is live.
 *
 * The subscription is per-query and the listener is on `MediaQueryList` rather
 * than a resize handler, so a visitor who turns reduced motion on, or rotates
 * a tablet across the breakpoint, is answered without the page polling for it.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  )

  const getServerSnapshot = useCallback(() => serverValue, [serverValue])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** The preference itself, spelled once so the two call sites cannot drift. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
