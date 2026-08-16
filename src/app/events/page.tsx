import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, LinkCard } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { SESSION_TYPE_LABELS, type SessionType } from '@/lib/enums'
import {
  formatDateRange,
  formatTime,
  initials,
  parseJsonColumn,
  truncate,
} from '@/lib/format'
import { getCurrentEvent } from '@/lib/settings'

/**
 * Events — the forum's overview and programme (§4.4).
 *
 * The reference site's Events section lists many events; this forum runs one
 * flagship a year, so the same slot carries the programme instead. The card
 * grid is the reference's events grid, one card per session rather than per
 * event, which is the closest honest mapping.
 */

export const metadata: Metadata = {
  title: 'Events',
  description:
    'The Freetown Business Forum — theme, programme, speakers and how to register.',
  alternates: { canonical: '/events' },
}

export default async function EventsPage() {
  const event = await getCurrentEvent()

  const [sessions, speakerCount] = await Promise.all([
    event
      ? db.eventSession.findMany({
          where: { eventId: event.id, isPublished: true },
          orderBy: [{ dayNumber: 'asc' }, { startsAt: 'asc' }],
          include: {
            track: { select: { name: true } },
            speakers: {
              orderBy: { sortOrder: 'asc' },
              take: 3,
              include: {
                speaker: {
                  select: { fullName: true, photoUrl: true, organisation: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    db.speaker.count({ where: { isPublished: true } }),
  ])

  if (!event) {
    return (
      <>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Events', href: '/events' },
          ]}
        />
        <PageHero
          eyebrow="Events"
          title="The next forum is being"
          accent="planned"
          lead="Dates for the next edition have not been published yet. Join the briefing list and you will hear before it is announced publicly."
        />
      </>
    )
  }

  const objectives = parseJsonColumn<string[]>(event.objectivesJson, [])

  // Grouped by day so the grid reads as a programme rather than a pile.
  const days = [...new Set(sessions.map((session) => session.dayNumber))].sort(
    (a, b) => a - b,
  )

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Events', href: '/events' },
        ]}
      />

      <PageHero
        eyebrow={formatDateRange(event.startDate, event.endDate)}
        title={event.name}
        lead={event.theme ?? event.tagline ?? undefined}
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
        <ButtonLink
          href="/events/agenda"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Full agenda
        </ButtonLink>
      </PageHero>

      {/* Facts strip — the four things every enquiry asks first. */}
      <Section tone="muted" size="wide">
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Dates" value={formatDateRange(event.startDate, event.endDate)} />
          <Fact label="Venue" value={`${event.venueName}, ${event.city}`} />
          <Fact
            label="Expected"
            value={
              event.expectedDelegates
                ? `${event.expectedDelegates.toLocaleString('en-GB')} delegates`
                : 'Open to all'
            }
          />
          <Fact label="Speakers" value={`${speakerCount} confirmed`} />
        </dl>
      </Section>

      {event.description && (
        <Section tone="white" size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeading
                eyebrow="The theme"
                title={event.theme || 'This year’s forum'}
              />
            </div>

            <div className="lg:col-span-7">
              <p className="text-lg leading-relaxed text-ink-800">
                {event.description}
              </p>

              {objectives.length > 0 && (
                <ul className="mt-8 space-y-4">
                  {objectives.map((objective) => (
                    <li key={objective} className="flex gap-3">
                      <Icon
                        name="check"
                        className="mt-1 size-5 shrink-0 text-forest-600"
                      />
                      <span className="text-ink-700">{objective}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>
      )}

      {days.map((day) => {
        const daySessions = sessions.filter(
          (session) => session.dayNumber === day,
        )

        return (
          <Section
            key={day}
            tone={day % 2 === 1 ? 'muted' : 'white'}
            size="wide"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading
                eyebrow={`Day ${day}`}
                title={`Day ${day} programme`}
                className="mb-0"
              />
              <Link
                href={`/events/agenda#day-${day}`}
                className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
              >
                See the full day
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </div>

            <CardGrid columns={3} className="mt-10">
              {daySessions.map((session) => {
                const lead = session.speakers[0]?.speaker
                const others = session.speakers.length - 1

                return (
                  <LinkCard
                    key={session.id}
                    href={`/events/agenda#${session.slug}`}
                    className="h-full overflow-hidden"
                    padded={false}
                  >
                    <div className="relative h-40 bg-forest-800">
                      {lead?.photoUrl ? (
                        // Remote CMS URL — see the note in ui/card.tsx.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={lead.photoUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex size-full items-center justify-center font-display text-4xl font-bold text-white/25"
                        >
                          {lead ? initials(lead.fullName) : 'FBF'}
                        </span>
                      )}

                      <span className="absolute left-4 top-4 inline-flex items-center bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink-900">
                        {formatTime(session.startsAt)}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                          {SESSION_TYPE_LABELS[
                            session.sessionType as SessionType
                          ] ?? 'Session'}
                        </p>
                        {session.track && (
                          <Badge tone="neutral">{session.track.name}</Badge>
                        )}
                      </div>

                      <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                        {session.title}
                      </h3>

                      {session.description && (
                        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                          {truncate(session.description, 120)}
                        </p>
                      )}

                      {lead && (
                        <p className="mt-3 text-sm text-ink-600">
                          {lead.fullName}
                          {others > 0 && ` +${others} more`}
                        </p>
                      )}

                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                        Find out more
                        <Icon name="arrowRight" className="size-4" />
                      </span>
                    </div>
                  </LinkCard>
                )
              })}
            </CardGrid>
          </Section>
        )
      })}

      <CtaBand
        title="Register for the forum"
        lead="Member rates apply for the whole of your membership year, for as many colleagues as you send."
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
          href="/membership"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Join first
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t-2 border-ink-950 pt-5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </dt>
      <dd className="mt-2 font-display text-lg font-semibold leading-snug text-ink-950">
        {value}
      </dd>
    </div>
  )
}
