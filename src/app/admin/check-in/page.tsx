import type { Metadata } from 'next'

import { CheckInForm } from '@/components/site/check-in-form'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { RegistrationStatus } from '@/lib/enums'
import { Permission, requirePermission } from '@/lib/rbac'
import { getCurrentEvent } from '@/lib/settings'

/**
 * The registration desk (FR-05, §12).
 *
 * A single-purpose screen, because it is used standing up, on a laptop shared
 * by three stewards, with a queue. Everything that is not scanning a ticket is
 * somewhere else.
 *
 * The counters are rendered on load and not polled. A number that ticks by
 * itself invites the desk to watch it, and the figure that matters at 08:55 is
 * whether the room is filling, not whether it changed in the last four seconds.
 */

export const metadata: Metadata = {
  title: 'Check-in',
}

export default async function AdminCheckInPage() {
  await requirePermission(Permission.CHECKIN_PERFORM, {
    redirectTo: '/admin/check-in',
  })

  const event = await getCurrentEvent()

  const [expected, admitted] = await Promise.all([
    db.delegate.count({
      where: {
        registration: {
          status: RegistrationStatus.CONFIRMED,
          ...(event ? { eventId: event.id } : {}),
        },
      },
    }),
    db.delegate.count({
      where: {
        checkedInAt: { not: null },
        registration: {
          status: RegistrationStatus.CONFIRMED,
          ...(event ? { eventId: event.id } : {}),
        },
      },
    }),
  ])

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Check-in
        </h1>
        {event && (
          <p className="mt-2 leading-relaxed text-ink-600">
            {event.name} — {event.venueName}.
          </p>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-display text-3xl font-bold text-forest-700">
            {admitted}
          </p>
          <p className="mt-1 text-sm text-ink-600">admitted</p>
        </Card>
        <Card>
          <p className="font-display text-3xl font-bold text-ink-900">
            {expected - admitted}
          </p>
          <p className="mt-1 text-sm text-ink-600">still to arrive</p>
        </Card>
        <Card>
          <p className="font-display text-3xl font-bold text-ink-900">
            {expected}
          </p>
          <p className="mt-1 text-sm text-ink-600">confirmed delegates</p>
        </Card>
      </div>

      <Card>
        <CheckInForm />
      </Card>

      <div className="flex gap-3 rounded-xl bg-ink-50 p-5">
        <Icon name="shield" className="mt-0.5 size-5 shrink-0 text-ink-500" />
        <div className="text-sm leading-relaxed text-ink-600">
          <p>
            Every code is signature-checked before it is looked up, so a
            photographed or forged QR will not scan.
          </p>
          <p className="mt-2">
            If a delegate has no code, find them on the registrations screen by
            name and read the ticket code from their booking.
          </p>
        </div>
      </div>
    </div>
  )
}
