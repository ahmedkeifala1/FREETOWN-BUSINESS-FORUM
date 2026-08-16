import Link from 'next/link'
import type { Metadata } from 'next'

import { HeroMosaic, type MosaicTile } from '@/components/site/hero-mosaic'
import { MembershipTabs, type MembershipTab } from '@/components/site/membership-tabs'
import { NewsletterForm } from '@/components/site/newsletter-form'
import { Testimonials } from '@/components/site/testimonials'
import { ButtonLink } from '@/components/ui/button'
import { Badge, Card, LinkCard, Stat } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  CardGrid,
  Container,
  CtaBand,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import {
  SESSION_TYPE_LABELS,
  SPONSOR_TIER_ORDER,
  SPONSOR_TIER_LABELS,
  type SessionType,
} from '@/lib/enums'
import {
  daysUntil,
  formatDateRange,
  formatDateShort,
  formatTime,
  initials,
  parseJsonColumn,
  truncate,
} from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { getCurrentEvent, getSectors, getSettings, setting } from '@/lib/settings'

/**
 * Homepage (SDR §4.2).
 *
 * Every band on this page is read from the database — the hero, the stats, the
 * endorsements, the programme, the speaker wall, the sector grid, the news
 * cards and the sponsor strip (FR-01). Nothing here is hard-coded copy except
 * the section headings, which are structural rather than editorial.
 *
 * The layout follows the reference the secretariat gave us
 * (londonbusinessforum.com): a statement hero with a cycling phrase,
 * endorsements immediately under it as proof, then a photo-forward programme
 * and speaker wall, with membership as tabs rather than four price cards. The
 * palette, typography and section list stay as specified in §3.2/§4.2 — this
 * is that page's rhythm, not its brand.
 *
 * The queries run in two `Promise.all` batches rather than sequentially.
 * Awaiting them in series would add each round-trip to time-to-first-byte,
 * which is the budget that matters on a 3G handset (NFR-01).
 */

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const [settings, event, sectors] = await Promise.all([
    getSettings(),
    getCurrentEvent(),
    getSectors(),
  ])

  const [
    featuredSpeakers,
    sessions,
    testimonials,
    articles,
    sponsors,
    tiers,
    opportunities,
  ] = await Promise.all([
    db.speaker.findMany({
      where: { isPublished: true, isFeatured: true },
      orderBy: { sortOrder: 'asc' },
      take: 12,
    }),
    // The programme cards, in the order they run. Breaks and networking slots
    // are excluded — a card that says "Coffee, 11:00" is not a reason to come.
    event
      ? db.eventSession.findMany({
          where: {
            eventId: event.id,
            isPublished: true,
            sessionType: {
              in: ['KEYNOTE', 'PLENARY', 'PANEL', 'ROUNDTABLE', 'WORKSHOP'],
            },
          },
          orderBy: [{ dayNumber: 'asc' }, { startsAt: 'asc' }],
          take: 6,
          include: {
            speakers: {
              orderBy: { sortOrder: 'asc' },
              include: {
                speaker: {
                  select: { fullName: true, photoUrl: true, organisation: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    db.testimonial.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
      take: 6,
    }),
    db.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: { category: { select: { name: true, slug: true } } },
    }),
    event
      ? db.sponsor.findMany({
          where: { eventId: event.id, isPublished: true },
          orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }],
        })
      : Promise.resolve([]),
    db.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.opportunity.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: { sector: { select: { name: true } } },
    }),
  ])

  const whoAttends = parseJsonColumn<string[]>(event?.whoAttendsJson ?? null, [])

  return (
    <>
      {event && <EventStructuredData event={event} />}

      <Hero
        settings={settings}
        event={event}
        tiles={buildMosaic(featuredSpeakers, settings, sectors.length)}
      />
      <Testimonials items={testimonials} />
      <IntroStatement settings={settings} />
      {event && <Programme event={event} sessions={sessions} />}
      <SpeakerWall speakers={featuredSpeakers} />
      <WhoShouldAttend whoAttends={whoAttends} />
      <Sectors sectors={sectors} />
      <DealRoomTeaser opportunities={opportunities} />
      <MembershipTeaser tiers={tiers} />
      <LatestNews articles={articles} />
      <SponsorStrip sponsors={sponsors} />
      <NewsletterBand settings={settings} />
    </>
  )
}

/**
 * Interleave speaker portraits with figure tiles for the hero mosaic.
 *
 * A figure lands every fourth tile, which in a three-column grid means no two
 * of them ever share a row or sit directly above one another — the block reads
 * as scattered without being randomised, and a random layout would differ
 * between the server render and the client's (NFR-01).
 */
function buildMosaic(
  speakers: Array<{ id: string; fullName: string; photoUrl: string | null }>,
  settings: Record<string, string>,
  sectorCount: number,
): MosaicTile[] {
  // A figure with no value behind it is left out rather than shown as a blank
  // tile — an unseeded settings row must not become a hole in the hero.
  const allFigures: MosaicTile[] = [
    {
      kind: 'figure',
      id: 'figure-delegates',
      icon: 'users',
      value: settings['stats.delegates']
        ? `${Number(settings['stats.delegates']).toLocaleString('en-GB')}+`
        : '',
      label: 'Delegates',
    },
    {
      kind: 'figure',
      id: 'figure-countries',
      icon: 'globe',
      value: settings['stats.countries'] ?? '',
      label: 'Countries',
    },
    {
      kind: 'figure',
      id: 'figure-sectors',
      icon: 'briefcase',
      value: sectorCount ? String(sectorCount) : '',
      label: 'Priority sectors',
    },
  ]

  const figures = allFigures.filter(
    (tile) => tile.kind === 'figure' && tile.value !== '',
  )

  const portraits: MosaicTile[] = speakers.map((speaker) => ({
    kind: 'speaker',
    id: speaker.id,
    name: speaker.fullName,
    photoUrl: speaker.photoUrl,
  }))

  const tiles: MosaicTile[] = []
  let nextFigure = 0

  for (const portrait of portraits) {
    if (tiles.length % 4 === 3 && nextFigure < figures.length) {
      tiles.push(figures[nextFigure])
      nextFigure += 1
    }
    tiles.push(portrait)
  }

  return tiles.concat(figures.slice(nextFigure))
}

// ── 1. Hero ─────────────────────────────────────────────────────────────────

/**
 * The statement hero (§4.2), built to the composition of the reference page
 * the secretariat gave us.
 *
 * Near-black ground; a lead-in line and three stacked words at display size
 * with the last in the accent, which is the whole left half. The right half is
 * a colour panel carrying a crawl of sector names, with the strongest
 * endorsement laid over it — proof sits inside the hero rather than waiting in
 * a band below the fold.
 *
 * The panel is absolutely positioned on `lg` so it reaches the right edge of
 * the viewport without any `100vw` arithmetic, which overflows by the width of
 * the scrollbar on Windows. Below `lg` it returns to normal flow and stacks
 * under the headline, after the call to action rather than before it.
 */
function Hero({
  settings,
  event,
  tiles,
}: {
  settings: Record<string, string>
  event: Awaited<ReturnType<typeof getCurrentEvent>>
  tiles: MosaicTile[]
}) {
  const countdown = event ? daysUntil(event.startDate) : null

  const statement = setting(settings, 'home.heroStatement')
  const words = setting(settings, 'home.heroWords')
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 3)

  return (
    <section className="relative isolate overflow-hidden bg-ink-950 text-white">
      <Container size="wide">
        <div className="py-14 sm:py-20 lg:w-[54%] lg:py-28 lg:pr-10">
          {event && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-white/70">
              <span className="font-semibold text-gold-400">
                {formatDateRange(event.startDate, event.endDate)}
              </span>
              <span aria-hidden="true" className="text-white/30">
                ·
              </span>
              <span>
                {event.venueName}, {event.city}
              </span>
              {countdown !== null && countdown > 0 && (
                <>
                  <span aria-hidden="true" className="text-white/30">
                    ·
                  </span>
                  <span>{countdown} days to go</span>
                </>
              )}
            </p>
          )}

          {/* One icon per word, cross-fading in step with the highlight. */}
          {words.length > 0 && (
            <span aria-hidden="true" className="mt-8 grid w-fit">
              {words.map((word, index) => (
                <Icon
                  key={word}
                  name={HERO_ICONS[index % HERO_ICONS.length]}
                  strokeWidth={1.5}
                  className="hero-cycle-icon size-14 sm:size-16"
                  style={{
                    animationDelay: `${index * 3}s`,
                    color: `var(${HERO_ACCENTS[index % HERO_ACCENTS.length]})`,
                  }}
                />
              ))}
            </span>
          )}

          <h1 className="mt-7">
            {/* The lead-in is the smaller line above the stack — "a forum for
                those who" — and the three words complete the sentence. */}
            <span className="block font-display text-2xl font-semibold uppercase leading-tight tracking-tight text-white sm:text-3xl">
              {statement}
            </span>

            <span className="mt-3 block font-display text-6xl font-extrabold uppercase leading-[0.88] tracking-tighter sm:text-7xl lg:text-[5.5rem]">
              {words.map((word, index) => (
                <span
                  key={word}
                  className="hero-cycle-word block text-white"
                  style={{
                    animationDelay: `${index * 3}s`,
                    // Read by the keyframes; each word lights in its own hue.
                    ['--hero-accent' as string]: `var(${HERO_ACCENTS[index % HERO_ACCENTS.length]})`,
                  }}
                >
                  {word}
                </span>
              ))}
            </span>
          </h1>

          <p className="mt-8 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            {event?.tagline ?? setting(settings, 'site.tagline')}
          </p>

          {/* Square-cornered and uppercase, matching the reference. Local to
              the hero — the rounded system button is still what every other
              page uses (§3.5). */}
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {event?.registrationOpen && (
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
              href="/invest/opportunities"
              size="lg"
              className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10 active:bg-white/15"
            >
              Explore opportunities
            </ButtonLink>
          </div>
        </div>
      </Container>

      {/* The mosaic runs off the bottom and right of the viewport rather than
          fitting itself to the hero — the tiles reading as a wall that
          continues past the edge is the point of the composition. */}
      <div className="relative min-h-104 bg-ink-900 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%] lg:min-h-0">
        <HeroMosaic tiles={tiles} />
      </div>
    </section>
  )
}

/** One icon per hero word — invest, partner, build — in that order. */
const HERO_ICONS = ['trending', 'handshake', 'building']

/**
 * The highlight changes hue as it moves down the words, as it does on the
 * reference page. Gold leads, since that is the brand accent (§3.2); the other
 * two are the primary and secondary at the tints that hold up on near-black.
 */
const HERO_ACCENTS = [
  '--color-gold-400',
  '--color-forest-400',
  '--color-harbour-400',
]

// ── 2. Intro statement with stat counters ───────────────────────────────────

function IntroStatement({ settings }: { settings: Record<string, string> }) {
  const stats = [
    { value: settings['stats.delegates'], label: 'Delegates expected', suffix: '+' },
    { value: settings['stats.countries'], label: 'Countries represented', suffix: '' },
    { value: settings['stats.sectors'], label: 'Priority sectors', suffix: '' },
    { value: settings['stats.dealValue'], label: 'Deals facilitated', prefix: 'US$', suffix: 'm' },
  ].filter((stat) => stat.value)

  return (
    <Section tone="white" size="wide">
      <div className="max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-forest-700">
          Who we are
        </p>

        <h2 className="mt-4 text-3xl leading-tight text-ink-950 sm:text-4xl lg:text-5xl">
          The forum where Sierra Leonean enterprise meets capital.
        </h2>

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-700">
          FBF convenes the private sector, government and development partners
          in a standing dialogue, runs the country&rsquo;s principal annual
          investment forum, and maintains the national business directory and
          Deal Room.
        </p>

        <ButtonLink href="/about" variant="outline" size="md" className="mt-8">
          About the forum
          <Icon name="arrowRight" className="size-4" />
        </ButtonLink>
      </div>

      {stats.length > 0 && (
        <dl className="mt-14 grid grid-cols-2 gap-8 border-t border-ink-200 pt-10 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <Stat
                value={`${stat.prefix ?? ''}${Number(stat.value).toLocaleString('en-GB')}${stat.suffix ?? ''}`}
                label={stat.label}
              />
            </div>
          ))}
        </dl>
      )}
    </Section>
  )
}

// ── 3. Programme highlights ─────────────────────────────────────────────────

type ProgrammeSession = {
  id: string
  slug: string
  title: string
  description: string | null
  dayNumber: number
  startsAt: Date
  endsAt: Date
  sessionType: string
  speakers: Array<{
    speaker: { fullName: string; photoUrl: string | null; organisation: string }
  }>
}

/**
 * The programme as a photo-forward card grid (§4.2 "forum highlights").
 *
 * Each card leads with the first speaker's photograph, because a face is what
 * makes someone stop on a session they have not heard of. Cards deep-link into
 * the agenda rather than to a session page — the agenda is where the room,
 * the track and the neighbouring sessions are, which is what someone clicking
 * "Find out more" actually wants next.
 */
function Programme({
  event,
  sessions,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getCurrentEvent>>>
  sessions: ProgrammeSession[]
}) {
  const objectives = parseJsonColumn<string[]>(event.objectivesJson, [])

  return (
    <Section tone="muted" size="wide">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow="The forum"
          title={event.theme || 'Programme highlights'}
          lead={event.description ?? undefined}
          className="mb-0"
        />

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/forum" size="md">
            Overview &amp; theme
          </ButtonLink>
          <ButtonLink href="/forum/agenda" variant="outline" size="md">
            Full agenda
          </ButtonLink>
        </div>
      </div>

      {sessions.length > 0 ? (
        <CardGrid columns={3} className="mt-10">
          {sessions.map((session) => {
            const lead = session.speakers[0]?.speaker
            const others = session.speakers.length - 1

            return (
              <LinkCard
                key={session.id}
                href={`/events/agenda#${session.slug}`}
                className="h-full overflow-hidden"
                padded={false}
              >
                <div className="relative h-44 bg-forest-800">
                  {lead?.photoUrl ? (
                    // CMS image URLs are arbitrary remote hosts, so next/image
                    // cannot be used here — see the note in ui/card.tsx.
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

                  <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink-900">
                    Day {session.dayNumber} · {formatTime(session.startsAt)}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                    {SESSION_TYPE_LABELS[session.sessionType as SessionType] ??
                      'Session'}
                  </p>

                  <h3 className="mt-2 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                    {session.title}
                  </h3>

                  {lead && (
                    <p className="mt-2 text-sm text-ink-600">
                      {lead.fullName}, {lead.organisation}
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
      ) : (
        objectives.length > 0 && (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {objectives.map((objective) => (
              <li key={objective}>
                <Card className="flex h-full gap-3">
                  <Icon
                    name="check"
                    className="mt-0.5 size-5 shrink-0 text-forest-600"
                  />
                  <span className="text-ink-800">{objective}</span>
                </Card>
              </li>
            ))}
          </ul>
        )
      )}
    </Section>
  )
}

// ── 4. Speaker wall ─────────────────────────────────────────────────────────

/**
 * A wall of faces (§4.2 "featured speakers").
 *
 * Photographs at tile size with the name over them, rather than avatars on
 * cards — the point of this band is the calibre of the room, and that reads
 * from the faces before it reads from the job titles.
 */
function SpeakerWall({
  speakers,
}: {
  speakers: Array<{
    id: string
    slug: string
    fullName: string
    title: string
    organisation: string
    photoUrl: string | null
  }>
}) {
  if (speakers.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Speakers"
          title="Who you will hear from"
          className="mb-0"
        />
        <Link
          href="/forum/speakers"
          className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:text-forest-800 hover:underline"
        >
          See all speakers
          <Icon name="arrowRight" className="size-4" />
        </Link>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {speakers.map((speaker) => (
          <li key={speaker.id}>
            <Link
              href={`/events/speakers/${speaker.slug}`}
              className="group relative block aspect-4/5 overflow-hidden rounded-xl bg-forest-800"
            >
              {speaker.photoUrl ? (
                // Remote CMS URL — see the note in ui/card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={speaker.photoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-full items-center justify-center font-display text-4xl font-bold text-white/25"
                >
                  {initials(speaker.fullName)}
                </span>
              )}

              {/* The scrim is what keeps the white name legible over a light
                  photograph — without it the contrast depends on whatever the
                  secretariat uploaded (NFR-09). */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-forest-950/95 via-forest-950/55 to-transparent"
              />

              <span className="absolute inset-x-0 bottom-0 p-4">
                <span className="block font-display text-sm font-semibold leading-tight text-white">
                  {speaker.fullName}
                </span>
                <span className="mt-1 block text-xs leading-tight text-white/75">
                  {truncate(speaker.title, 46)}
                </span>
                <span className="mt-0.5 block text-xs font-medium leading-tight text-gold-300">
                  {truncate(speaker.organisation, 40)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ── 5. Who should attend ────────────────────────────────────────────────────

const AUDIENCE_ICONS = [
  'trending',
  'building',
  'shield',
  'globe',
  'users',
  'handshake',
]

function WhoShouldAttend({ whoAttends }: { whoAttends: string[] }) {
  if (whoAttends.length === 0) return null

  return (
    <Section tone="muted" size="wide">
      <SectionHeading
        eyebrow="Who attends"
        title="Built for the people who move capital and make policy"
        lead="Three days of plenaries, sector roundtables and scheduled one-to-one meetings, designed around what each audience came to do."
      />

      {/* Rules rather than cards: six bordered boxes in a row read as a form,
          and this is a list of audiences, not a set of choices. */}
      <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {whoAttends.map((audience, index) => (
          <li key={audience} className="border-t border-ink-300 pt-5">
            <span className="flex size-10 items-center justify-center rounded-lg bg-forest-100 text-forest-700">
              <Icon
                name={AUDIENCE_ICONS[index % AUDIENCE_ICONS.length]}
                className="size-5"
              />
            </span>
            <p className="mt-4 leading-relaxed text-ink-800">{audience}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ── 6. Sectors ──────────────────────────────────────────────────────────────

function Sectors({
  sectors,
}: {
  sectors: Array<{
    id: string
    slug: string
    name: string
    summary: string
    iconKey: string
  }>
}) {
  if (sectors.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <SectionHeading
        eyebrow="Opportunities"
        title="Eight sectors, one investment case"
        lead="Each sector page sets out the data, the incentives on offer, and the live opportunities seeking capital."
      />

      <CardGrid columns={4} className="mt-10">
        {sectors.map((sector) => (
          <LinkCard key={sector.id} href={`/learning-hub/sectors/${sector.slug}`}>
            <span className="flex size-11 items-center justify-center rounded-lg bg-harbour-50 text-harbour-700">
              <Icon name={sector.iconKey} className="size-5" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-ink-950 group-hover:text-forest-700">
              {sector.name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {truncate(sector.summary, 130)}
            </p>
          </LinkCard>
        ))}
      </CardGrid>
    </Section>
  )
}

// ── 7. Deal Room teaser ─────────────────────────────────────────────────────

function DealRoomTeaser({
  opportunities,
}: {
  opportunities: Array<{
    id: string
    slug: string
    title: string
    summary: string
    region: string | null
    currency: string
    ticketSizeMinMinor: number | null
    ticketSizeMaxMinor: number | null
    sector: { name: string } | null
  }>
}) {
  return (
    <Section tone="harbour" size="wide">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <SectionHeading
            eyebrow="Deal Room"
            title="Capital and businesses, in the same room"
            lead="Businesses submit propositions; investors request access. The secretariat matches both sides and schedules the meetings in advance, so the second day of the forum is spent talking rather than looking."
            inverted
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/invest/apply" variant="accent" size="md">
              Apply for funding
            </ButtonLink>
            <ButtonLink
              href="/invest/opportunities"
              size="md"
              className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              Browse opportunities
            </ButtonLink>
          </div>
        </div>

        {opportunities.length > 0 && (
          <ul className="space-y-4 lg:col-span-7">
            {opportunities.map((opportunity) => (
              <li key={opportunity.id}>
                <Link
                  href={`/deal-room/${opportunity.slug}`}
                  className="group block rounded-xl border border-white/15 bg-white/5 p-5 transition hover:border-white/35 hover:bg-white/10"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {opportunity.sector && (
                      <Badge className="bg-white/10 text-white ring-white/20">
                        {opportunity.sector.name}
                      </Badge>
                    )}
                    {opportunity.region && (
                      <span className="text-xs text-white/60">
                        {opportunity.region}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2.5 font-display text-base font-semibold text-white group-hover:text-gold-300">
                    {opportunity.title}
                  </h3>

                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                    {truncate(opportunity.summary, 150)}
                  </p>

                  {opportunity.ticketSizeMinMinor !== null && (
                    <p className="mt-3 text-sm font-medium text-gold-300">
                      Seeking{' '}
                      {formatMoney(
                        opportunity.ticketSizeMinMinor,
                        opportunity.currency === 'USD' ? 'USD' : 'SLE',
                        { compact: true },
                      )}
                      {opportunity.ticketSizeMaxMinor
                        ? ` – ${formatMoney(
                            opportunity.ticketSizeMaxMinor,
                            opportunity.currency === 'USD' ? 'USD' : 'SLE',
                            { compact: true },
                          )}`
                        : ''}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

// ── 8. Membership teaser ────────────────────────────────────────────────────

function MembershipTeaser({
  tiers,
}: {
  tiers: Array<{
    id: string
    slug: string
    name: string
    strapline: string | null
    priceMinor: number
    currency: string
    featuresJson: string
  }>
}) {
  if (tiers.length === 0) return null

  const tabs: MembershipTab[] = tiers.map((tier) => ({
    id: tier.id,
    slug: tier.slug,
    name: tier.name,
    strapline: tier.strapline,
    price: formatMoney(
      tier.priceMinor,
      tier.currency === 'USD' ? 'USD' : 'SLE',
      { compact: true },
    ),
    features: parseJsonColumn<string[]>(tier.featuresJson, []),
  }))

  return (
    <Section tone="muted" size="wide">
      <SectionHeading
        eyebrow="Membership"
        title="Join FBF"
        lead="Membership carries a directory listing, member rates on forum registration, access to the Deal Room, and a standing seat in the dialogue with government."
        align="center"
      />

      <MembershipTabs tabs={tabs} />
    </Section>
  )
}

// ── 9. Latest news ──────────────────────────────────────────────────────────

function LatestNews({
  articles,
}: {
  articles: Array<{
    id: string
    slug: string
    title: string
    excerpt: string
    publishedAt: Date | null
    heroImageUrl: string | null
    category: { name: string; slug: string } | null
  }>
}) {
  if (articles.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="News" title="Latest from the forum" className="mb-0" />
        <Link
          href="/news"
          className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:text-forest-800 hover:underline"
        >
          All news &amp; insights
          <Icon name="arrowRight" className="size-4" />
        </Link>
      </div>

      <CardGrid columns={3} className="mt-8">
        {articles.map((article) => (
          <LinkCard
            key={article.id}
            href={`/blog/${article.slug}`}
            className="h-full"
            padded={false}
          >
            {article.heroImageUrl && (
              // Remote CMS URL — see the note in ui/card.tsx.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={article.heroImageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-44 w-full rounded-t-xl object-cover"
              />
            )}

            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {article.category && (
                  <Badge tone="forest">{article.category.name}</Badge>
                )}
                {article.publishedAt && (
                  <time
                    dateTime={article.publishedAt.toISOString()}
                    className="text-xs text-ink-500"
                  >
                    {formatDateShort(article.publishedAt)}
                  </time>
                )}
              </div>

              <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                {article.title}
              </h3>

              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                {truncate(article.excerpt, 140)}
              </p>

              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                Read more
                <Icon name="arrowRight" className="size-4" />
              </span>
            </div>
          </LinkCard>
        ))}
      </CardGrid>
    </Section>
  )
}

// ── 10. Sponsors ────────────────────────────────────────────────────────────

function SponsorStrip({
  sponsors,
}: {
  sponsors: Array<{
    id: string
    slug: string
    name: string
    tier: string
    logoUrl: string | null
    website: string | null
  }>
}) {
  if (sponsors.length === 0) {
    return (
      <CtaBand
        title="Become a sponsor"
        lead="Sponsorship puts your organisation in front of the people setting Sierra Leone's economic agenda."
      >
        <ButtonLink href="/forum/sponsors" variant="accent" size="lg">
          Sponsorship options
        </ButtonLink>
      </CtaBand>
    )
  }

  // Group by tier so Platinum reads before Silver, in the order set in enums.ts.
  const byTier = SPONSOR_TIER_ORDER.map((tier) => ({
    tier,
    label: SPONSOR_TIER_LABELS[tier],
    sponsors: sponsors.filter((sponsor) => sponsor.tier === tier),
  })).filter((group) => group.sponsors.length > 0)

  return (
    <Section tone="muted" size="wide">
      <SectionHeading
        eyebrow="Partners"
        title="Sponsors &amp; partners"
        lead="The forum is delivered with the support of the organisations below."
        align="center"
      />

      <div className="mt-10 space-y-8">
        {byTier.map((group) => (
          <div key={group.tier}>
            <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-ink-500">
              {group.label}
            </p>

            <ul className="flex flex-wrap items-center justify-center gap-3">
              {group.sponsors.map((sponsor) => (
                <li key={sponsor.id}>
                  <Link
                    href={`/events/sponsors#${sponsor.slug}`}
                    className="flex min-h-16 items-center justify-center rounded-lg border border-ink-200 bg-white px-5 py-3 text-center text-sm font-medium text-ink-700 transition hover:border-forest-300 hover:text-forest-700"
                  >
                    {sponsor.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- see ui/card.tsx
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        loading="lazy"
                        decoding="async"
                        className="max-h-10 w-auto"
                      />
                    ) : (
                      sponsor.name
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <ButtonLink href="/forum/sponsors" variant="outline" size="md">
          Become a sponsor
        </ButtonLink>
      </div>
    </Section>
  )
}

// ── 11. Newsletter ──────────────────────────────────────────────────────────

function NewsletterBand({ settings }: { settings: Record<string, string> }) {
  return (
    <Section tone="forest">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl text-white sm:text-3xl">
          Get the monthly briefing
        </h2>
        <p className="mt-3 text-white/80">
          {setting(
            settings,
            'newsletter.blurb',
            'Investment opportunities, policy changes and forum news — once a month.',
          )}
        </p>
        <NewsletterForm className="mt-6 text-left" source="homepage" />
      </div>
    </Section>
  )
}

// ── Structured data (NFR-10) ────────────────────────────────────────────────

/**
 * schema.org Event markup, so search engines show the forum's dates and venue
 * directly in results. Rendered as JSON-LD in a script tag — the format Google
 * documents, and the only one that does not require decorating the markup.
 */
function EventStructuredData({
  event,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getCurrentEvent>>>
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://slbf.sl'

  const payload = {
    '@context': 'https://schema.org',
    '@type': 'BusinessEvent',
    name: event.name,
    description: event.description ?? event.theme,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venueName,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.venueAddress,
        addressLocality: event.city,
        addressCountry: event.country,
      },
    },
    organizer: {
      '@type': 'Organization',
      name: 'Freetown Business Forum',
      url: siteUrl,
    },
    url: `${siteUrl}/forum`,
  }

  return (
    <script
      type="application/ld+json"
      // The payload is built from database columns, not user input, and
      // JSON.stringify escapes the string values it contains.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
