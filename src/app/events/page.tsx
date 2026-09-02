import Link from 'next/link'
import type { Metadata } from 'next'

import { HeroMosaic, type MosaicTile } from '@/components/site/hero-mosaic'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  CtaBand,
  EmptyState,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { SESSION_TYPE_LABELS, type SessionType } from '@/lib/enums'
import {
  formatDateRange,
  formatDuration,
  formatTime,
  formatWeekday,
  formatWeekdayFull,
  initials,
  parseJsonColumn,
  pluralise,
  truncate,
} from '@/lib/format'
import { getCurrentEvent } from '@/lib/settings'

/**
 * Events — the forum's overview and programme (§4.4).
 *
 * Built to the same shape as the reference site's events page, section for
 * section: a split hero — an outlined glyph, the eyebrow and a headline whose
 * second half is the number, set against a wall of speaker photographs filling
 * the right — then the breadcrumbs underneath it rather than above, one
 * "filter by" dropdown at the head of the listing, then the listing itself as
 * full-width rows: a landscape photograph on the left, and on the right a
 * title, a subtitle, the bold fact lines (speakers, when, where, how long) and
 * a truncated description ending in "…more".
 *
 * The reference lists many events a year and filters them by month; this forum
 * runs one flagship over consecutive days, so the listing carries its sessions
 * and the filter offers days. That is the closest honest mapping.
 *
 * The forum's own material — the facts strip, the theme and the registration
 * band — follows the listing rather than interrupting it, so the top of the
 * page reads the way the reference does and nothing the section used to say is
 * lost.
 *
 * Two deliberate departures from the reference: the filter is a `<details>`
 * disclosure holding real links rather than a scripted select, so every
 * filtered view is an address that works before hydration (NFR-01); and times
 * stay 24-hour, because `format.ts` fixes that app-wide to keep the server and
 * the browser rendering the same string.
 */

export const metadata: Metadata = {
  title: 'Events',
  description:
    'The Freetown Business Forum — theme, programme, speakers and how to register.',
  alternates: { canonical: '/events' },
}

const CRUMBS = [
  { label: 'Home', href: '/' },
  { label: 'Events', href: '/events' },
]

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const [{ day }, event] = await Promise.all([searchParams, getCurrentEvent()])

  const [sessions, speakerCount, speakerPhotos, galleryPhotos] = await Promise.all([
    event
      ? db.eventSession.findMany({
          where: { eventId: event.id, isPublished: true },
          orderBy: [
            { dayNumber: 'asc' },
            { startsAt: 'asc' },
            { sortOrder: 'asc' },
          ],
          include: {
            track: { select: { name: true } },
            // Three names is what a row has space for; the count carries the
            // rest, so "+4 more" stays true however many are attached.
            _count: { select: { speakers: true } },
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
    // The hero wall. Faces first, as on the reference site, whose events hero
    // is a grid of the speakers it is selling — featured ones lead, because
    // the first tiles are the ones read on a phone before the wall scrolls.
    db.speaker.findMany({
      where: { isPublished: true, photoUrl: { not: null } },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      take: 12,
      select: { id: true, photoUrl: true },
    }),
    // Topped up from the forum's own photographs, so the wall is full in a
    // year whose speakers have not been photographed yet.
    db.mediaAsset.findMany({
      where: {
        isPublic: true,
        kind: 'GALLERY',
        collection: { slug: 'forum-gallery', isPublished: true },
      },
      orderBy: { sortOrder: 'asc' },
      take: 12,
      select: { id: true, url: true },
    }),
  ])

  const heroTiles: MosaicTile[] = [
    ...speakerPhotos.map((speaker) => ({
      kind: 'photo' as const,
      id: speaker.id,
      url: speaker.photoUrl as string,
    })),
    ...galleryPhotos.map((asset) => ({
      kind: 'photo' as const,
      id: asset.id,
      url: asset.url,
    })),
  ].slice(0, 12)

  if (!event) {
    return (
      <>
        <PageHero
          eyebrow="Events"
          title="The next forum is being"
          accent="planned"
          lead="Dates for the next edition have not been published yet. Join the briefing list and you will hear before it is announced publicly."
        />
        <Breadcrumbs items={CRUMBS} />
      </>
    )
  }

  const objectives = parseJsonColumn<string[]>(event.objectivesJson, [])

  const days = [...new Set(sessions.map((session) => session.dayNumber))].sort(
    (a, b) => a - b,
  )

  const dayName = (n: number) => {
    const first = sessions.find((session) => session.dayNumber === n)
    return first ? formatWeekday(first.startsAt) : `Day ${n}`
  }

  // No day, or one the programme does not have, shows the whole programme: the
  // list is short enough to read end to end, and an empty page is a worse
  // answer to a mistyped URL than more than was asked for.
  const requestedDay = Number(day)
  const activeDay = days.includes(requestedDay) ? requestedDay : null
  const visible =
    activeDay === null
      ? sessions
      : sessions.filter((session) => session.dayNumber === activeDay)

  return (
    <>
      {/*
        The reference site's events hero, composed the way the homepage and
        membership heroes already are: text in the left 54%, a wall of faces
        filling the right. The outlined gold glyph above the eyebrow is theirs
        too — it is the one place on the page where the section announces
        itself as a picture rather than a word.

        The eyebrow is white here rather than the gold every other PageHero
        uses. Gold is already doing two jobs in this band, the glyph and the
        emphasised half of the headline, and a third would flatten both.
      */}
      <section className="relative isolate overflow-hidden bg-ink-950 text-white">
        <Container size="wide">
          <div className="py-14 sm:py-20 lg:w-[54%] lg:py-24 lg:pr-10">
            <span
              aria-hidden="true"
              className="inline-flex size-14 items-center justify-center border-2 border-gold-400 text-gold-400"
            >
              <Icon name="users" className="size-7" />
            </span>

            <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-white/85">
              Events
            </p>

            <h1 className="mt-6 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
              Meet the people building Sierra Leone’s economy across{' '}
              <span className="text-gold-400">
                {sessions.length > 0
                  ? `${sessions.length} ${pluralise(sessions.length, 'session')} over ${days.length} ${pluralise(days.length, 'day')}`
                  : 'three days in Freetown'}
              </span>
              .
            </h1>

            <p className="mt-8 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
              {event.name} — {event.theme} — at {event.venueName},{' '}
              {event.city}, {formatDateRange(event.startDate, event.endDate)}.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink
                href="#sessions"
                variant="accent"
                size="lg"
                className="rounded-none font-semibold uppercase tracking-wider"
              >
                Upcoming sessions
              </ButtonLink>
              <ButtonLink
                href="/membership"
                size="lg"
                className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10 active:bg-white/15"
              >
                Find out about membership
              </ButtonLink>
            </div>
          </div>
        </Container>

        {heroTiles.length > 0 && (
          <div className="relative min-h-104 bg-ink-900 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%] lg:min-h-0">
            <HeroMosaic tiles={heroTiles} />
          </div>
        )}
      </section>

      {/* Below the hero, as on the reference site. */}
      <Breadcrumbs items={CRUMBS} />

      {/* ── The listing ──────────────────────────────────────────────────── */}

      <Section id="sessions" tone="white" size="wide">
        {days.length > 1 && (
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            {/*
              A disclosure rather than a select: it opens to a list of ordinary
              links, so a filtered day is a real address and the whole control
              works with JavaScript off. `open` is not forced — the browser
              closes it again on navigation, which is the behaviour a reader
              expects from a dropdown.
            */}
            <details className="group relative">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-3 border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-900 hover:border-ink-400">
                {activeDay === null
                  ? 'Filter by day'
                  : `Day ${activeDay} — ${dayName(activeDay)}`}
                <Icon
                  name="chevronDown"
                  className="size-4 text-ink-500 transition-transform group-open:rotate-180"
                />
              </summary>

              <ul className="absolute left-0 top-full z-20 mt-1 w-72 border border-ink-200 bg-white py-1 shadow-xl">
                <FilterOption href="/events" selected={activeDay === null}>
                  All days
                </FilterOption>
                {days.map((n) => (
                  <FilterOption
                    key={n}
                    href={`/events?day=${n}`}
                    selected={activeDay === n}
                  >
                    Day {n} — {dayName(n)}
                  </FilterOption>
                ))}
              </ul>
            </details>

            <Link
              href="/events/agenda"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
            >
              See the full agenda
              <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>
        )}

        {visible.length === 0 ? (
          <EmptyState
            title="No sessions published yet"
            message="The programme is confirmed a few weeks before the forum. Register and you will be emailed when it is published."
          >
            <ButtonLink href="/register" variant="primary">
              Register to attend
            </ButtonLink>
          </EmptyState>
        ) : (
          <div className="divide-y divide-ink-200 border-t border-ink-200">
            {visible.map((session) => {
              const lead = session.speakers[0]?.speaker
              const named = session.speakers
                .map((entry) => entry.speaker.fullName)
                .join(', ')
              const others = session._count.speakers - session.speakers.length
              const href = `/events/agenda#${session.slug}`
              const subtitle = [
                SESSION_TYPE_LABELS[session.sessionType as SessionType],
                session.track?.name,
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <article
                  key={session.id}
                  className="grid gap-6 py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-10"
                >
                  {/* The photograph repeats the title's link, so it is hidden
                      from assistive technology rather than read out twice on
                      the way to the heading. */}
                  <Link
                    href={href}
                    tabIndex={-1}
                    aria-hidden="true"
                    className="block aspect-970/590 overflow-hidden bg-forest-800"
                  >
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
                      <span className="flex size-full items-center justify-center font-display text-5xl font-bold text-white/25">
                        {lead ? initials(lead.fullName) : 'FBF'}
                      </span>
                    )}
                  </Link>

                  <div className="min-w-0">
                    <h2 className="font-display text-2xl font-bold leading-tight text-ink-950 sm:text-3xl">
                      <Link href={href} className="hover:text-forest-700">
                        {session.title}
                      </Link>
                    </h2>

                    {subtitle && (
                      <h3 className="mt-2 text-lg font-medium text-ink-600">
                        {subtitle}
                      </h3>
                    )}

                    <div className="mt-4 space-y-1.5 text-sm font-semibold text-ink-900">
                      {named && (
                        <p>
                          Speakers:{' '}
                          <span className="text-forest-700">{named}</span>
                          {others > 0 && (
                            <span className="text-forest-700">
                              {' '}
                              +{others} more
                            </span>
                          )}
                        </p>
                      )}

                      <p>
                        {formatWeekdayFull(session.startsAt)} |{' '}
                        {formatTime(session.startsAt)}
                      </p>

                      <p className="flex items-center gap-2">
                        <Icon name="pin" className="size-4 text-ink-500" />
                        {session.room ?? event.venueName}
                      </p>

                      <p className="flex items-center gap-2">
                        <Icon name="clock" className="size-4 text-ink-500" />
                        {formatDuration(session.startsAt, session.endsAt)}
                      </p>
                    </div>

                    {session.description && (
                      <p className="mt-4 text-base leading-relaxed text-ink-700">
                        {truncate(session.description, 220)}{' '}
                        <Link
                          href={href}
                          className="font-semibold text-forest-700 hover:underline"
                        >
                          …more
                        </Link>
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Section>

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

/** One day in the filter disclosure. The current day is marked, not hidden. */
function FilterOption({
  href,
  selected,
  children,
}: {
  href: string
  selected: boolean
  children: React.ReactNode
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? 'true' : undefined}
        className={
          selected
            ? 'flex items-center justify-between bg-ink-50 px-4 py-2.5 text-sm font-semibold text-ink-950'
            : 'flex items-center justify-between px-4 py-2.5 text-sm text-ink-700 hover:bg-ink-50 hover:text-ink-950'
        }
      >
        {children}
        {selected && <Icon name="check" className="size-4 text-forest-600" />}
      </Link>
    </li>
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
