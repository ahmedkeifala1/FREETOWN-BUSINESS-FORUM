import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AdminNav, type AdminNavGroup } from '@/components/site/admin-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Container, Section } from '@/components/ui/layout'
import { signOut } from '@/lib/actions/auth'
import { ROLE_LABELS } from '@/lib/enums'
import { Permission, requireStaff, userHas } from '@/lib/rbac'

/**
 * The admin panel shell (§12, FR-04).
 *
 * `requireStaff` runs once here for the whole segment, and each page then
 * asserts the specific permission it needs. Both matter: the layout keeps a
 * member from reaching the panel at all, and the per-page guard keeps an editor
 * out of the ledger. Neither is the nav — the nav is filtered for tidiness and
 * proves nothing (§12 "enforced server-side on every protected action").
 */

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin | Freetown Business Forum' },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireStaff()

  const groups: AdminNavGroup[] = [
    { heading: 'Overview', items: [{ label: 'Dashboard', href: '/admin' }] },
  ]

  const events: AdminNavGroup['items'] = []
  // The programme comes first in this group: it is what the forum *is*, and
  // registrations and check-in are things that happen against it.
  if (userHas(user, Permission.EVENT_MANAGE)) {
    events.push({ label: 'Programme', href: '/admin/programme' })
    events.push({ label: 'Speakers', href: '/admin/speakers' })
    // Below them, not above: the forum record is set up once an edition and
    // then left alone, while the programme is worked on every week.
    events.push({ label: 'Forums', href: '/admin/events' })
  }
  if (userHas(user, Permission.REGISTRATION_VIEW)) {
    events.push({ label: 'Registrations', href: '/admin/registrations' })
  }
  if (userHas(user, Permission.CHECKIN_PERFORM)) {
    events.push({ label: 'Check-in', href: '/admin/check-in' })
  }
  if (events.length > 0) groups.push({ heading: 'The forum', items: events })

  const money: AdminNavGroup['items'] = []
  if (userHas(user, Permission.PAYMENT_VIEW)) {
    money.push({ label: 'Payments', href: '/admin/payments' })
  }
  if (userHas(user, Permission.LEDGER_VIEW)) {
    money.push({ label: 'Ledger', href: '/admin/ledger' })
  }
  if (money.length > 0) groups.push({ heading: 'Money', items: money })

  const community: AdminNavGroup['items'] = []
  if (userHas(user, Permission.MEMBERSHIP_VIEW)) {
    community.push({ label: 'Members', href: '/admin/members' })
  }
  if (userHas(user, Permission.DEALROOM_VIEW)) {
    community.push({ label: 'Deal Room', href: '/admin/deal-room' })
  }
  if (userHas(user, Permission.SUBMISSION_VIEW)) {
    community.push({ label: 'Enquiries', href: '/admin/enquiries' })
  }
  if (community.length > 0) {
    groups.push({ heading: 'Community', items: community })
  }

  const content: AdminNavGroup['items'] = []
  if (userHas(user, Permission.CONTENT_EDIT)) {
    // Pages first: they are the standing copy of the site, and articles are
    // what gets added to it.
    content.push({ label: 'Pages', href: '/admin/pages' })
    content.push({ label: 'Articles', href: '/admin/articles' })
    content.push({ label: 'Media', href: '/admin/media' })
  }
  if (content.length > 0) groups.push({ heading: 'Content', items: content })

  const admin: AdminNavGroup['items'] = []
  if (userHas(user, Permission.USER_MANAGE)) {
    admin.push({ label: 'Users', href: '/admin/users' })
  }
  if (userHas(user, Permission.SETTINGS_MANAGE)) {
    admin.push({ label: 'Settings', href: '/admin/settings' })
  }
  if (userHas(user, Permission.AUDIT_VIEW)) {
    admin.push({ label: 'Audit log', href: '/admin/audit' })
  }
  if (admin.length > 0) {
    groups.push({ heading: 'Administration', items: admin })
  }

  return (
    <Section tone="muted" size="wide">
      <Container>
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display font-semibold text-ink-950">
                  Admin panel
                </p>
                <Badge tone="harbour">
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-ink-600">{user.email}</p>

              <hr className="my-5 border-ink-200" />

              <AdminNav groups={groups} />

              <hr className="my-5 border-ink-200" />

              {/* A form, not a link: ending a session is a state change, and a
                  GET that signs you out fires on any prefetch or scanner. */}
              <form action={signOut}>
                <Button type="submit" variant="ghost" size="sm" fullWidth>
                  Sign out
                </Button>
              </form>
            </div>
          </aside>

          <div className="lg:col-span-9">{children}</div>
        </div>
      </Container>
    </Section>
  )
}
