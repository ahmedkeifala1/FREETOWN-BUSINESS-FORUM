import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Avatar, Badge } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  CtaBand,
  EmptyState,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import {
  SESSION_TYPE_LABELS,
  SpeakerRole,
  type SessionType,
} from '@/lib/enums'
import {
  formatDateRange,
  formatTimeRange,
  formatWeekday,
  initials,
} from '@/lib/format'
import { getCurrentEvent } from '@/lib/settings'

/**
 * Agenda / programme (SDR §4.5).
 *
 * Day tabs, a track filter and a time-ordered list whose rows expand for the
 * description — all of it server-rendered, with the current day and track in
 * the URL.
 *
 * Nothing here needs JavaScript. The tabs and filters are links, so the state
 * is bookmarkable and shareable ("here's the day 2 finance track") and the
 * page works on a handset that has not finished loading the bundle (NFR-01).
 * The expandable rows are <details>, which the browser handles natively and
 * announces correctly to a screen reader (NFR-09) — a hand-built accordion
 * would be more markup, more script and worse.
 *
 * Sessions come from the database and update the moment an event manager edits
 * one (§4.5, FR-01).
 */

export const metadata: Metadata = {
  title: 'Agenda',
  description:
    'The full Freetown Business Forum programme, day by day — sessions, tracks, times, rooms and speakers.',
  alternates: { canonical: '/events/agenda' },
}

/** Sessions that are logistics rather than content get a quieter row. */
const BREAK_TYPES = new Set(['BREAK', 'NETWORKING'])

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string; track?: string }>
}) {
  const [{ day, track }, event] = await Promise.all([
    searchParams,
    getCurrentEvent(),
  ])

  if (!event) {
    return (
      <>
        <AgendaCrumbs />
        <PageHero
          eyebrow="Agenda"
          title="The programme is being"
          accent="built"
          lead="Sessions are published here as they are confirmed. Register and you will be told when the full programme goes live."
        />
      </>
    )
  }

  const [sessions, tracks] = await Promise.all([
    db.eventSession.findMany({
      where: { eventId: event.id, isPublished: true },
      orderBy: [
        { dayNumber: 'asc' },
        { startsAt: 'asc' },
        { sortOrder: 'asc' },
      ],
      include: {
        track: { select: { id: true, name: true, colour: true } },
        speakers: {
          orderBy: { sortOrder: 'asc' },
          include: {
            speaker: {
              select: {
                slug: true,
                fullName: true,
                title: true,
                organisation: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    }),
    db.track.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const days = [...new Set(sessions.map((s) => s.dayNumber))].sort(
    (a, b) => a - b,
  )

  // An out-of-range ?day= falls back to the first day rather than showing an
  // empty programme — a mistyped URL should not look like a cancelled forum.
  const requestedDay = Number(day)
  const activeDay = days.includes(requestedDay) ? requestedDay : (days[0] ?? 1)

  const activeTrack = tracks.some((t) => t.id === track) ? track : undefined

  const dayName = (n: number) => {
    const first = sessions.find((s) => s.dayNumber === n)
    return first ? formatWeekday(first.startsAt) : `Day ${n}`
  }

  const visible = sessions.filter(
    (session) =>
      session.dayNumber === activeDay &&
      // Breaks belong to every track: filtering them out would leave a track
      // view that reads as a solid block of sessions with no lunch in it.
      (!activeTrack ||
        session.trackId === activeTrack ||
        BREAK_TYPES.has(session.sessionType)),
  )

  const href = (next: { day?: number; track?: string }) => {
    const params = new URLSearchParams()
    const d = next.day ?? activeDay
    const t = 'track' in next ? next.track : activeTrack
    if (d !== days[0]) params.set('day', String(d))
    if (t) params.set('track', t)
    const query = params.toString()
    return query ? `/events/agenda?${query}` : '/events/agenda'
  }

  return (
    <>
      <AgendaCrumbs />

      <PageHero
        eyebrow={formatDateRange(event.startDate, event.endDate)}
        title="The"
        accent="programme"
        lead={`${sessions.length} sessions over ${days.length} ${
          days.length === 1 ? 'day' : 'days'
        } at ${event.venueName}. Pick a day, then narrow by track.`}
      >
        {event.registrationOpen && (
          <ButtonLink
            href="/register"
            variant="accent"
            size="lg"
            className="rounded-none font-semibold uppercase tracking-wider"
          >
            Register to attend
            <Icon name="arrowRight" className="size-5" />
          </ButtonLink>
        )}
        {event.brochureUrl && (
          <a
            href={event.brochureUrl}
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/40 px-6 py-3 text-base font-semibold uppercase tracking-wider text-white hover:bg-white/10"
          >
            <Icon name="download" className="size-5" />
            Download the brochure
          </a>
        )}
      </PageHero>

      {days.length === 0 ? (
        <Section tone="white">
          <EmptyState
            title="No sessions published yet"
            message="The programme is confirmed a few weeks before the forum. Register and you will be emailed when it is published."
          >
            <ButtonLink href="/register" variant="primary">
              Register to attend
            </ButtonLink>
          </EmptyState>
        </Section>
      ) : (
        <>
          {/*
            The day tabs stick to the top on scroll. A long programme is read
            by scrolling, and losing the day you are looking at halfway down
            the list is the single most annoying thing this page can do.
          */}
          <div className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
            <Container size="wide">
              <nav aria-label="Programme days">
                <ul className="-mb-px flex gap-1 overflow-x-auto">
                  {days.map((n) => {
                    const isActive = n === activeDay

                    return (
                      <li key={n} className="shrink-0">
                        <Link
                          href={href({ day: n })}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'inline-flex flex-col border-b-2 px-4 py-4 transition-colors sm:px-6',
                            isActive
                              ? 'border-forest-600 text-ink-950'
                              : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900',
                          )}
                        >
                          <span className="font-display text-sm font-semibold uppercase tracking-wider">
                            Day {n}
                          </span>
                          <span className="mt-0.5 text-xs text-ink-500">
                            {dayName(n)}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            </Container>
          </div>

          {tracks.length > 0 && (
            <div className="border-b border-ink-200 bg-ink-50">
              <Container size="wide">
                <div className="flex flex-wrap items-center gap-2 py-4">
                  <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
                    Track
                  </span>

                  <FilterPill
                    href={href({ track: undefined })}
                    active={!activeTrack}
                  >
                    All tracks
                  </FilterPill>

                  {tracks.map((t) => (
                    <FilterPill
                      key={t.id}
                      href={href({ track: t.id })}
                      active={activeTrack === t.id}
                    >
                      {t.name}
                    </FilterPill>
                  ))}
                </div>
              </Container>
            </div>
          )}

          <Section tone="white" size="wide">
            <h2 id={`day-${activeDay}`} className="scroll-mt-32 sr-only">
              Day {activeDay} — {dayName(activeDay)}
            </h2>

            {visible.length === 0 ? (
              <EmptyState
                title="Nothing on this track today"
                message="This track does not run on the selected day. Try another day, or clear the filter."
              >
                <Link
                  href={href({ track: undefined })}
                  className="font-medium text-forest-700 hover:underline"
                >
                  Show all tracks
                </Link>
              </EmptyState>
            ) : (
              <ol className="border-t border-ink-200">
                {visible.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </ol>
            )}
          </Section>
        </>
      )}

      <CtaBand
        title="Seats are allocated in registration order"
        lead="Roundtables and workshops have capped numbers. Registering early is how you get into the ones you came for."
      >
        <ButtonLink
          href="/register"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Register to attend
        </ButtonLink>
        <ButtonLink
          href="/events/speakers"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          See the speakers
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function AgendaCrumbs() {
  return (
    <Breadcrumbs
      items={[
        { label: 'Home', href: '/' },
        { label: 'Events', href: '/events' },
        { label: 'Agenda', href: '/events/agenda' },
      ]}
    />
  )
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex min-h-9 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-forest-600 text-white'
          : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-300 hover:ring-forest-400',
      )}
    >
      {children}
    </Link>
  )
}

type AgendaSession = {
  id: string
  slug: string
  title: string
  description: string | null
  startsAt: Date
  endsAt: Date
  room: string | null
  sessionType: string
  track: { id: string; name: string; colour: string } | null
  speakers: Array<{
    role: string
    speaker: {
      slug: string
      fullName: string
      title: string
      organisation: string
      photoUrl: string | null
    }
  }>
}

/**
 * One row of the programme.
 *
 * A <details> whose <summary> carries the whole row, so the entire strip is
 * the hit target on a phone rather than a chevron (§4.17 "touch-friendly
 * targets"). Rows with nothing to expand render as a plain list item — a
 * disclosure control that reveals nothing is a broken promise.
 */
function SessionRow({ session }: { session: AgendaSession }) {
  const isBreak = BREAK_TYPES.has(session.sessionType)
  const expandable = Boolean(session.description) || session.speakers.length > 0

  const head = (
    <div className="grid gap-x-6 gap-y-3 py-6 sm:grid-cols-[9rem_1fr] lg:grid-cols-[11rem_1fr]">
      <div>
        <p
          className={cn(
            'font-display text-sm font-semibold tabular-nums',
            isBreak ? 'text-ink-500' : 'text-ink-950',
          )}
        >
          <time dateTime={session.startsAt.toISOString()}>
            {formatTimeRange(session.startsAt, session.endsAt)}
          </time>
        </p>

        {session.room && (
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
            <Icon name="pin" className="size-3.5" />
            {session.room}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-xs font-semibold uppercase tracking-wider',
              isBreak ? 'text-ink-500' : 'text-forest-700',
            )}
          >
            {SESSION_TYPE_LABELS[session.sessionType as SessionType] ??
              'Session'}
          </span>

          {session.track && (
            <Badge tone="neutral">{session.track.name}</Badge>
          )}
        </div>

        <h3
          className={cn(
            'mt-1.5 font-display font-semibold leading-snug',
            isBreak
              ? 'text-base text-ink-700'
              : 'text-lg text-ink-950 sm:text-xl',
          )}
        >
          {session.title}
        </h3>

        {session.speakers.length > 0 && (
          <p className="mt-2 text-sm text-ink-600">
            {session.speakers
              .map(({ speaker }) => speaker.fullName)
              .join(' · ')}
          </p>
        )}

        {expandable && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
            <Icon
              name="chevronDown"
              className="size-4 transition-transform group-open:rotate-180"
            />
            <span className="group-open:hidden">Details</span>
            <span className="hidden group-open:inline">Hide details</span>
          </span>
        )}
      </div>
    </div>
  )

  if (!expandable) {
    return (
      <li id={session.slug} className="scroll-mt-40 border-b border-ink-200">
        {head}
      </li>
    )
  }

  return (
    <li id={session.slug} className="scroll-mt-40 border-b border-ink-200">
      <details className="group">
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          {head}
        </summary>

        <div className="grid gap-x-6 pb-8 sm:grid-cols-[9rem_1fr] lg:grid-cols-[11rem_1fr]">
          <div aria-hidden="true" />

          <div className="min-w-0">
            {session.description && (
              <p className="max-w-2xl leading-relaxed text-ink-700">
                {session.description}
              </p>
            )}

            {session.speakers.length > 0 && (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                {session.speakers.map(({ role, speaker }) => (
                  <li key={speaker.slug}>
                    <Link
                      href={`/events/speakers/${speaker.slug}`}
                      className="group/speaker flex items-start gap-3"
                    >
                      <Avatar
                        src={speaker.photoUrl}
                        name={speaker.fullName}
                        initials={initials(speaker.fullName)}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-ink-950 group-hover/speaker:text-forest-700">
                          {speaker.fullName}
                        </p>
                        <p className="text-sm text-ink-600">
                          {speaker.title}, {speaker.organisation}
                        </p>
                        {role !== SpeakerRole.SPEAKER && (
                          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-500">
                            {role.toLowerCase()}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>
    </li>
  )
}
