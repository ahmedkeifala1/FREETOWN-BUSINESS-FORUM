import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { EmptyState } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import { SESSION_TYPE_LABELS, type SessionType } from '@/lib/enums'
import {
  formatDateRange,
  formatTimeRange,
  formatWeekdayFull,
} from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * The programme (§4.5, FR-01).
 *
 * The same shape as the public agenda — days in order, sessions by time —
 * because the thing an event manager is checking is whether the public agenda
 * is right, and a differently arranged admin view makes them do that
 * translation in their head. What is added is what the public page hides:
 * unpublished sessions, sitting in place among the published ones so a gap in
 * the day is visible as a gap rather than as nothing at all.
 *
 * Which forum is being edited comes from `?event=`, defaulting to the current
 * one. Programmes are edited for months before a forum and corrected for weeks
 * after it, so the panel cannot only ever address whichever event is live.
 */

export const metadata: Metadata = {
  title: 'Programme',
}

/** Sessions that are logistics rather than content, as on the public agenda. */
const BREAK_TYPES = new Set(['BREAK', 'NETWORKING'])

export default async function AdminProgrammePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  await requirePermission(Permission.EVENT_MANAGE, { redirectTo: '/admin' })

  const { event: requestedEvent } = await searchParams

  const events = await db.event.findMany({
    orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
    },
  })

  if (events.length === 0) {
    return (
      <div className="space-y-8">
        <ProgrammeHeading />
        <EmptyState
          title="No forum to build a programme for"
          message="A programme belongs to an event, and there is no event in the database yet. Seed one, or create it directly, and the programme can be built here."
        />
      </div>
    )
  }

  // An unknown ?event= falls back to the current forum rather than showing
  // nothing — a stale bookmark should not look like a deleted programme.
  const event =
    events.find((candidate) => candidate.id === requestedEvent) ?? events[0]!

  const [tracks, sessions] = await Promise.all([
    db.track.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, colour: true },
    }),
    db.eventSession.findMany({
      where: { eventId: event.id },
      orderBy: [{ dayNumber: 'asc' }, { startsAt: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        room: true,
        dayNumber: true,
        sessionType: true,
        isPublished: true,
        track: { select: { name: true, colour: true } },
        _count: { select: { speakers: true } },
      },
    }),
  ])

  const days = [...new Set(sessions.map((session) => session.dayNumber))].sort(
    (a, b) => a - b,
  )

  const unpublished = sessions.filter((session) => !session.isPublished).length

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <ProgrammeHeading />

        <ButtonLink
          href={`/admin/programme/sessions/new?event=${event.id}`}
          size="md"
        >
          Add a session
        </ButtonLink>
      </header>

      {/*
        Only drawn when there is a choice to make. A single-forum organisation
        should not be asked which forum it means.
      */}
      {events.length > 1 && (
        <nav aria-label="Forum" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
            Forum
          </span>
          {events.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/admin/programme?event=${candidate.id}`}
              aria-current={candidate.id === event.id ? 'true' : undefined}
              className={cn(
                'inline-flex min-h-9 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                candidate.id === event.id
                  ? 'bg-forest-600 text-white'
                  : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-300 hover:ring-forest-400',
              )}
            >
              {candidate.name}
            </Link>
          ))}
        </nav>
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-ink-950">
              {event.name}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              {formatDateRange(event.startDate, event.endDate)} ·{' '}
              {sessions.length} session{sessions.length === 1 ? '' : 's'}
              {unpublished > 0 && ` · ${unpublished} not yet public`}
            </p>
          </div>

          <Link
            href={`/admin/programme/tracks?event=${event.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
          >
            {tracks.length === 0
              ? 'Set up tracks'
              : `Tracks (${tracks.length})`}
            <Icon name="arrowRight" className="size-4" />
          </Link>
        </div>

        {tracks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-ink-100 pt-4">
            {tracks.map((track) => (
              <span
                key={track.id}
                className="inline-flex items-center gap-2 text-sm text-ink-700"
              >
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  style={{ backgroundColor: track.colour }}
                />
                {track.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      {sessions.length === 0 ? (
        <EmptyState
          title="Nothing scheduled yet"
          message="Sessions you add appear here in time order, day by day, exactly as they will read on the public agenda."
        >
          <ButtonLink
            href={`/admin/programme/sessions/new?event=${event.id}`}
            size="md"
          >
            Add the first session
          </ButtonLink>
        </EmptyState>
      ) : (
        days.map((day) => {
          const onThisDay = sessions.filter(
            (session) => session.dayNumber === day,
          )

          return (
            <section key={day} className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-ink-950">
                Day {day}
                <span className="ml-2 font-sans text-sm font-normal text-ink-600">
                  {formatWeekdayFull(onThisDay[0]!.startsAt)}
                </span>
              </h2>

              <Card padded={false}>
                <ul className="divide-y divide-ink-100">
                  {onThisDay.map((session) => (
                    <li key={session.id}>
                      <Link
                        href={`/admin/programme/sessions/${session.id}`}
                        className="block px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                      >
                        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-[8rem_1fr_auto]">
                          <p
                            className={cn(
                              'text-sm font-semibold tabular-nums',
                              session.isPublished
                                ? 'text-ink-950'
                                : 'text-ink-500',
                            )}
                          >
                            {formatTimeRange(session.startsAt, session.endsAt)}
                          </p>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'text-xs font-semibold uppercase tracking-wider',
                                  BREAK_TYPES.has(session.sessionType)
                                    ? 'text-ink-500'
                                    : 'text-forest-700',
                                )}
                              >
                                {SESSION_TYPE_LABELS[
                                  session.sessionType as SessionType
                                ] ?? 'Session'}
                              </span>

                              {session.track && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
                                  <span
                                    aria-hidden="true"
                                    className="size-2.5 rounded-full"
                                    style={{
                                      backgroundColor: session.track.colour,
                                    }}
                                  />
                                  {session.track.name}
                                </span>
                              )}
                            </div>

                            <p
                              className={cn(
                                'mt-0.5 font-medium',
                                session.isPublished
                                  ? 'text-ink-950'
                                  : 'text-ink-600',
                              )}
                            >
                              {session.title}
                            </p>

                            <p className="mt-1 text-sm text-ink-500">
                              {session.room ?? 'No room set'}
                              {' · '}
                              {session._count.speakers === 0
                                ? 'no speakers'
                                : `${session._count.speakers} speaker${session._count.speakers === 1 ? '' : 's'}`}
                            </p>
                          </div>

                          <div className="sm:self-center">
                            {session.isPublished ? (
                              <Badge tone="success">Public</Badge>
                            ) : (
                              <Badge tone="warning">Draft</Badge>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )
        })
      )}
    </div>
  )
}

function ProgrammeHeading() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink-950">
        Programme
      </h1>
      <p className="mt-2 leading-relaxed text-ink-600">
        Sessions, tracks and who is speaking. Changes reach the public agenda as
        soon as they are saved.
      </p>
    </div>
  )
}
