import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Stamp the requested path onto the request headers.
 *
 * A layout has no way to ask what page is being rendered beneath it, and the
 * portal and admin guards live in layouts so that every route in those segments
 * is protected once rather than each remembering to protect itself. Without
 * this, a visitor bounced off `/portal/tickets` would be sent back to `/portal`
 * after signing in — the layout is what redirects, and all it knew was its own
 * segment.
 *
 * Deliberately nothing else happens here. It would be tempting to do the auth
 * check in the proxy, but session lookup is a database read and this runs on
 * every request including static assets; more importantly, an edge check is a
 * convenience rather than a control, and §12 wants the decision made server-side
 * next to the data. The guards stay in the layouts and this only tells them
 * where the visitor was going.
 */

export const PATHNAME_HEADER = 'x-pathname'

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers)

  headers.set(
    PATHNAME_HEADER,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  )

  // `request.headers`, not `headers` — the former is passed upstream to the
  // render, the latter would expose it to the browser.
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ['/portal/:path*', '/admin/:path*'],
}
