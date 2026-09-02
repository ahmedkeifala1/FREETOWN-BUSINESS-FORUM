import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { SessionForm } from '@/components/site/session-form'
import { SessionSpeakers } from '@/components/site/session-speakers-form'
import { Badge, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { formatDateRange, toDateTimeInput } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Add or edit one session (§4.5, FR-01).
 *
 * `/admin/programme/sessions/new?event=…` is the empty form and any other id
 * loads that session — one form component for both, so the two can never come
 * to disagree about what a valid session is.
 *
 * The line-up panel appears only once the session exists. A speaker assignment
 * needs a session id to hang from, and asking someone to pick panellists for
 * something that has not been saved is asking them to lose the list.
 */

export const metadata: Metadata = {
  title: 'Session',
}

export default async function AdminSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ event?: string }>
}) {
  await requirePermission(Permission.EVENT_MANAGE, { redirectTo: '/admin' })

  const [{ id }, { event: requestedEvent }] = await Promise.all([
    params,
    searchParams,
  ])

  const isNew = id === 'new'

  const session = isNew
    ? null
    : await db.eventSession.findUnique({
        where: { id },
        select: {
          id: true,
          eventId: true,
          title: true,
          slug: true,
          description: true,
          trackId: true,
          startsAt: true,
          endsAt: true,
          room: true,
          sessionType: true,
          sortOrder: true,
          dayNumber: true,
          isPublished: true,
          speakers: {
            orderBy: { sortOrder: 'asc' },
            select: {
              role: true,
              speaker: {
                select: {
                  id: true,
                  fullName: true,
                  title: true,
                  organisation: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      })

  if (!isNew && !session) notFound()

  // A new session belongs to the forum it was started from; an existing one to
  // its own, whatever the query string says.
  const eventId = session?.eventId ?? requestedEvent

  const event = eventId
    ? await db.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, startDate: true, endDate: true },
      })
    : await db.event.findFirst({
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        select: { id: true, name: true, startDate: true, endDate: true },
      })

  if (!event) notFound()

  const [tracks, speakers] = await Promise.all([
    db.track.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    db.speaker.findMany({
      orderBy: [{ sortOrder: 'asc' }, { fullName: 'asc' }],
      select: { id: true, fullName: true, organisation: true },
    }),
  ])

  const assignedIds = new Set(
    session?.speakers.map((entry) => entry.speaker.id) ?? [],
  )

  /*
    The time controls are bounded by the forum's own dates. `min` and `max` are
    a hint rather than the constraint — the server checks the day against the
    start date regardless — but they open the picker on the right week, which
    is most of the value on a date field months away from today.
  */
  const eventWindow = {
    min: toDateTimeInput(event.startDate),
    max: toDateTimeInput(event.endDate),
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/programme?event=${event.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          Programme
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {isNew ? 'Add a session' : session!.title}
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            {event.name} ·{' '}
            {formatDateRange(event.startDate, event.endDate)}
            {session && ` · day ${session.dayNumber}`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {session &&
            (session.isPublished ? (
              <Badge tone="success">Public</Badge>
            ) : (
              <Badge tone="warning">Draft</Badge>
            ))}
          {session?.isPublished && (
            <Link
              href={`/events/agenda?day=${session.dayNumber}#${session.slug}`}
              className="text-sm font-medium text-forest-700 hover:underline"
            >
              View on the agenda
            </Link>
          )}
        </div>
      </header>

      <Card>
        <SessionForm
          eventId={event.id}
          eventName={event.name}
          tracks={tracks}
          eventWindow={eventWindow}
          defaults={
            session
              ? {
                  id: session.id,
                  title: session.title,
                  slug: session.slug,
                  description: session.description,
                  trackId: session.trackId,
                  startsAt: toDateTimeInput(session.startsAt),
                  endsAt: toDateTimeInput(session.endsAt),
                  room: session.room,
                  sessionType: session.sessionType,
                  sortOrder: session.sortOrder,
                  isPublished: session.isPublished,
                }
              : null
          }
        />
      </Card>

      {session && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-950">
              Who is speaking
            </h2>
            <p className="mt-1 max-w-prose text-sm text-ink-600">
              Listed on the agenda and on each speaker’s own page, in the order
              they are added here.
            </p>
          </div>

          <Card>
            <SessionSpeakers
              sessionId={session.id}
              lineUp={session.speakers.map((entry) => ({
                speakerId: entry.speaker.id,
                fullName: entry.speaker.fullName,
                title: entry.speaker.title,
                organisation: entry.speaker.organisation,
                photoUrl: entry.speaker.photoUrl,
                role: entry.role,
              }))}
              available={speakers.filter(
                (speaker) => !assignedIds.has(speaker.id),
              )}
            />
          </Card>
        </section>
      )}
    </div>
  )
}
