import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { EventForm } from '@/components/site/event-form'
import { Badge, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { parseJsonColumn, toDateTimeInput } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Add or edit one forum (§4.4).
 *
 * `/admin/events/new` is the empty form; any other id loads that forum.
 *
 * What hangs off the forum is summarised at the top but not editable here —
 * sessions belong to the programme, sponsors and tickets to their own screens.
 * The counts are shown because they are the context for the edit: moving the
 * dates of a forum with a hundred and forty delegates booked against it is a
 * different act from moving the dates of an empty one, and the person doing it
 * should be able to see which they are looking at.
 */

export const metadata: Metadata = {
  title: 'Forum',
}

export default async function AdminEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission(Permission.EVENT_MANAGE, { redirectTo: '/admin' })

  const { id } = await params
  const isNew = id === 'new'

  const event = isNew
    ? null
    : await db.event.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          theme: true,
          tagline: true,
          startDate: true,
          endDate: true,
          venueName: true,
          venueAddress: true,
          city: true,
          country: true,
          venueMapUrl: true,
          venueLat: true,
          venueLng: true,
          description: true,
          objectivesJson: true,
          expectedDelegates: true,
          heroImageUrl: true,
          brochureUrl: true,
          prospectusUrl: true,
          isCurrent: true,
          isPublished: true,
          registrationOpen: true,
          _count: {
            select: {
              sessions: true,
              tracks: true,
              registrations: true,
              sponsors: true,
              ticketTypes: true,
            },
          },
        },
      })

  if (!isNew && !event) notFound()

  const counts = event
    ? [
        { label: 'sessions', value: event._count.sessions },
        { label: 'tracks', value: event._count.tracks },
        { label: 'ticket types', value: event._count.ticketTypes },
        { label: 'sponsors', value: event._count.sponsors },
        { label: 'registrations', value: event._count.registrations },
      ]
    : []

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          All forums
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {isNew ? 'Add a forum' : event!.name}
          </h1>
          {event && (
            <p className="mt-2 max-w-prose text-sm text-ink-600">
              {event.theme}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {event?.isCurrent && <Badge tone="harbour">Current</Badge>}
          {event &&
            (event.isPublished ? (
              <Badge tone="success">Public</Badge>
            ) : (
              <Badge tone="warning">Draft</Badge>
            ))}
        </div>
      </header>

      {event && (
        <Card>
          <p className="text-sm text-ink-600">
            What is attached to this forum:{' '}
            {counts
              .map((count) => `${count.value} ${count.label}`)
              .join(' · ')}
            . Sessions and tracks are edited from the{' '}
            <Link
              href={`/admin/programme?event=${event.id}`}
              className="font-medium text-forest-700 hover:underline"
            >
              programme
            </Link>
            .
          </p>
        </Card>
      )}

      <Card>
        <EventForm
          defaults={
            event
              ? {
                  id: event.id,
                  name: event.name,
                  slug: event.slug,
                  theme: event.theme,
                  tagline: event.tagline,
                  // The same UTC-in, UTC-out pair the programme uses: the
                  // control has no zone of its own, so the value is written and
                  // read as the UTC that lib/format renders in.
                  startDate: toDateTimeInput(event.startDate),
                  endDate: toDateTimeInput(event.endDate),
                  venueName: event.venueName,
                  venueAddress: event.venueAddress,
                  city: event.city,
                  country: event.country,
                  venueMapUrl: event.venueMapUrl,
                  venueLat: event.venueLat,
                  venueLng: event.venueLng,
                  description: event.description,
                  objectives: parseJsonColumn<string[]>(
                    event.objectivesJson,
                    [],
                  ).join('\n'),
                  expectedDelegates: event.expectedDelegates,
                  heroImageUrl: event.heroImageUrl,
                  brochureUrl: event.brochureUrl,
                  prospectusUrl: event.prospectusUrl,
                  isCurrent: event.isCurrent,
                  isPublished: event.isPublished,
                  registrationOpen: event.registrationOpen,
                }
              : null
          }
        />
      </Card>
    </div>
  )
}
