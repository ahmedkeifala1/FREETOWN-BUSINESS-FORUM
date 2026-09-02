import Link from 'next/link'
import type { Metadata } from 'next'

import { CurrentForumForm } from '@/components/site/current-forum-form'
import { ButtonLink } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { formatDateRange } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * The forums (§4.4).
 *
 * Almost always a list of one or two — this year's and next year's — so it is
 * a full listing rather than anything paged, and the row carries the counts
 * that say whether a forum is safe to change: a forum with three hundred
 * registrations against it is not one whose dates should be moved lightly.
 *
 * Newest first, because the forum being planned is the forum being edited.
 */

export const metadata: Metadata = {
  title: 'Forums',
}

export default async function AdminEventsPage() {
  await requirePermission(Permission.EVENT_MANAGE, { redirectTo: '/admin' })

  const events = await db.event.findMany({
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      name: true,
      theme: true,
      startDate: true,
      endDate: true,
      venueName: true,
      city: true,
      isCurrent: true,
      isPublished: true,
      registrationOpen: true,
      _count: { select: { sessions: true, registrations: true } },
    },
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Forums
          </h1>
          <p className="mt-2 max-w-prose leading-relaxed text-ink-600">
            Each edition of the forum — its dates, its venue and whether
            registration is open. One of them is the forum the site promotes,
            and it is the one the header, the homepage and registration all
            follow.
          </p>
        </div>

        <ButtonLink href="/admin/events/new" size="md">
          Add a forum
        </ButtonLink>
      </header>

      {events.length === 0 ? (
        <EmptyState
          title="No forum yet"
          message="Create the forum first. Tracks, sessions, tickets and sponsors all hang off it."
        >
          <ButtonLink href="/admin/events/new" size="md">
            Create the forum
          </ButtonLink>
        </EmptyState>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="font-medium text-ink-950 hover:underline"
                  >
                    {event.name}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-ink-600">
                    {event.theme}
                  </p>
                  <p className="mt-1 text-sm text-ink-500">
                    {formatDateRange(event.startDate, event.endDate)} ·{' '}
                    {event.venueName}, {event.city}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {event._count.sessions} session
                    {event._count.sessions === 1 ? '' : 's'} ·{' '}
                    {event._count.registrations} registration
                    {event._count.registrations === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {event.isCurrent && <Badge tone="harbour">Current</Badge>}
                    {event.isPublished ? (
                      <Badge tone="success">Public</Badge>
                    ) : (
                      <Badge tone="warning">Draft</Badge>
                    )}
                    {event.isPublished && !event.registrationOpen && (
                      <Badge tone="neutral">Registration closed</Badge>
                    )}
                  </div>

                  {/*
                    Offered only on the forums that could take the flag — the
                    current one already has it, and an unpublished one would be
                    refused by the action. A button that is going to be refused
                    is a button that should not be drawn.
                  */}
                  {!event.isCurrent && event.isPublished && (
                    <CurrentForumForm
                      eventId={event.id}
                      eventName={event.name}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
