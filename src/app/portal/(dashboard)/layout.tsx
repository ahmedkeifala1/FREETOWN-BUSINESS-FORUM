import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { PortalNav, type PortalNavItem } from '@/components/site/portal-nav'
import { Button } from '@/components/ui/button'
import { Container, Section } from '@/components/ui/layout'
import { signOut } from '@/lib/actions/auth'
import { requireUser } from '@/lib/rbac'

/**
 * The signed-in portal shell (§4.16).
 *
 * `requireUser` runs here so every page in this segment is guarded once rather
 * than each remembering to guard itself, and an anonymous visitor is sent to
 * the login page carrying the address they were trying to reach. The login and
 * password pages live outside this route group precisely so that this guard
 * cannot bounce someone off the page they need in order to satisfy it.
 *
 * The nav is built from the session: a delegate with no membership is not shown
 * membership sections. Each page still checks for itself (§12).
 */

export const metadata: Metadata = {
  title: { default: 'Portal', template: '%s | Portal | Freetown Business Forum' },
  robots: { index: false, follow: false },
}

export default async function PortalLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser({ redirectTo: '/portal' })

  const items: PortalNavItem[] = [
    { label: 'Dashboard', href: '/portal', icon: 'user' },
    { label: 'My tickets', href: '/portal/tickets', icon: 'ticket' },
  ]

  if (user.memberId) {
    items.push(
      { label: 'My membership', href: '/portal/membership', icon: 'users' },
      { label: 'Directory listing', href: '/portal/listing', icon: 'building' },
    )
  }

  items.push({ label: 'My details', href: '/portal/profile', icon: 'document' })

  return (
    <Section tone="muted" size="wide">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                Signed in as
              </p>
              <p className="mt-1 font-display font-semibold text-ink-950">
                {user.fullName}
              </p>
              <p className="truncate text-sm text-ink-600">{user.email}</p>

              <hr className="my-5 border-ink-200" />

              <PortalNav items={items} />

              <hr className="my-5 border-ink-200" />

              {/* A form, not a link: signing out is a state change, and a GET
                  that ends a session is triggered by any prefetch or scanner. */}
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm" fullWidth>
                  Sign out
                </Button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-9">{children}</div>
        </div>
      </Container>
    </Section>
  )
}
