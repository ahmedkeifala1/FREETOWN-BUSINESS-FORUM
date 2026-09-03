import Link from 'next/link'
import type { Metadata } from 'next'

import { Faq, type FaqItem } from '@/components/site/faq'
import { HeroMosaic, type MosaicTile } from '@/components/site/hero-mosaic'
import {
  MembershipTabs,
  type MembershipTab,
} from '@/components/site/membership-tabs'
import { SessionCard, type SessionCardSession } from '@/components/site/session-card'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  CtaBand,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { parseJsonColumn } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import {
  getCurrentEvent,
  getPageBlocks,
  getSettings,
  type PageCopy,
} from '@/lib/settings'

/**
 * Membership — why join, what it costs, and what it gets you (SDR §4.10).
 *
 * Laid out to the reference page the secretariat gave us
 * (londonbusinessforum.com/membership): a statement hero, the process in three
 * numbered steps, the three things membership opens with a photograph against
 * each, the benefits as tabs rather than a wall of price cards, proof in the
 * form of the organisations already in membership, then the money, then the
 * programme itself, then the objections answered in an accordion.
 *
 * Every band reads from the database (FR-01) — the tiers and their features,
 * the member and standard forum rates, the directory listings, and the steps
 * and questions from the `membership` CMS page.
 */

export const metadata: Metadata = {
  title: 'Membership',
  description:
    'Join the Freetown Business Forum — directory listing, member rates on forum registration, Deal Room access and a seat in the dialogue with government.',
  alternates: { canonical: '/membership' },
}

export default async function MembershipPage() {
  const [settings, blocks, event, tiers, listings, photos] = await Promise.all([
    getSettings(),
    getPageBlocks('membership'),
    getCurrentEvent(),
    db.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.directoryListing.findMany({
      where: { isPublished: true },
      orderBy: [{ isFeatured: 'desc' }, { businessName: 'asc' }],
      take: 18,
      select: { id: true, slug: true, businessName: true, logoUrl: true },
    }),
    // The same photographs the homepage hero uses, in the order the
    // secretariat set on the collection. The hero took member logos before
    // this, which meant a first screen of initials on flat grey for every
    // member without a logo on file.
    db.mediaAsset.findMany({
      where: {
        isPublic: true,
        kind: 'GALLERY',
        collection: { slug: 'forum-gallery', isPublished: true },
      },
      orderBy: { sortOrder: 'asc' },
      take: 12,
      select: { id: true, url: true, altText: true },
    }),
  ])

  // Both of these need the event, so they run as a second batch rather than
  // joining the first.
  const [ticketTypes, sessions] = await Promise.all([
    // The two rates the value proposition turns on. Fetched by slug rather
    // than by price order — "the cheapest ticket" and "the member ticket" are
    // not the same thing, and the student rate would win that comparison.
    event
      ? db.ticketType.findMany({
          where: { eventId: event.id, isActive: true, slug: { in: ['standard', 'member'] } },
          select: { slug: true, name: true, priceMinor: true, currency: true },
        })
      : Promise.resolve([]),
    // Three programme cards, breaks excluded, as on the homepage.
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
          take: 3,
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
  ])

  // The same `copy(key, fallback)` contract the rest of the site uses, built
  // over blocks this page already has in hand. The bands below take it as a
  // prop because they are functions in this file, not routes of their own.
  const copy = (key: string, fallback: string) => blocks[key] || fallback

  const standardRate = ticketTypes.find((ticket) => ticket.slug === 'standard')
  const memberRate = ticketTypes.find((ticket) => ticket.slug === 'member')

  const steps = parseJsonColumn<Array<{ title: string; body: string }>>(
    blocks.steps ?? null,
    [],
  )
  const faqs = parseJsonColumn<FaqItem[]>(blocks.faq ?? null, [])
  const access = parseJsonColumn<AccessItem[]>(blocks.access ?? null, [])

  // The band takes the last three photographs and the hero takes the rest, so
  // no photograph appears twice on the page and which one goes where is
  // settled by `sortOrder` in the admin panel rather than here.
  const bandPhotos = photos.slice(-3)
  const heroPhotos = photos.slice(0, Math.max(0, photos.length - 3))

  const tabs: MembershipTab[] = tiers.map((tier) => ({
    id: tier.id,
    slug: tier.slug,
    name: tier.name,
    strapline: tier.strapline,
    price: formatMoney(tier.priceMinor, tier.currency === 'USD' ? 'USD' : 'SLE', {
      compact: true,
    }),
    features: parseJsonColumn<string[]>(tier.featuresJson, []),
  }))

  return (
    <>
      {/* The reference page has no breadcrumb. Ours keeps one: it is the
          convention on every other interior page, and dropping wayfinding to
          match a page that never had it is a downgrade, not a replica. */}
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Membership', href: '/membership' },
        ]}
      />

      <MembershipHero
        blocks={blocks}
        settings={settings}
        tierCount={tiers.length}
        photos={heroPhotos}
      />

      <HowItWorks steps={steps} copy={copy} />

      <AccessBand items={access} photos={bandPhotos} copy={copy} />

      <Section tone="white" size="wide">
        <SectionHeading
          eyebrow={copy('tiersEyebrow', 'What you get')}
          title={copy('tiersTitle', 'Four tiers, one membership')}
          lead={blocks.intro}
          align="center"
        />
        <MembershipTabs tabs={tabs} />
      </Section>

      <MemberStrip listings={listings} copy={copy} />

      {standardRate && memberRate && (
        <MemberRate
          standard={standardRate}
          member={memberRate}
          eventName={event?.name ?? 'the forum'}
        />
      )}

      <UpcomingSessions sessions={sessions} copy={copy} />

      <Section tone="muted" size="wide">
        <SectionHeading
          eyebrow={copy('faqEyebrow', 'Questions')}
          title={copy('faqTitle', 'Before you apply')}
          lead={copy(
            'faqLead',
            'The things the secretariat is asked most often. If yours is not here, the contact form reaches a person, not a queue.',
          )}
        />
        <Faq items={faqs} />
      </Section>

      <CtaBand
        title={copy('ctaTitle', 'Join FBF')}
        lead={copy(
          'ctaLead',
          'Applications are decided within five working days. You can save the form and come back to it.',
        )}
      >
        <ButtonLink
          href="/membership/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Become a member
        </ButtonLink>
        <ButtonLink
          href="/contact"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Talk to the secretariat
        </ButtonLink>
      </CtaBand>
    </>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

/**
 * The same composition as the homepage hero — near-black ground, display type,
 * mosaic filling the right — so the two read as one site. The accent lands on
 * a phrase inside the sentence rather than on a stacked word cycle: this page
 * is making an argument, and the argument needs to be read as a sentence.
 */
function MembershipHero({
  blocks,
  settings,
  tierCount,
  photos,
}: {
  blocks: Record<string, string>
  settings: Record<string, string>
  tierCount: number
  photos: Array<{ id: string; url: string }>
}) {
  const photographs: MosaicTile[] = photos.map((photo) => ({
    kind: 'photo',
    id: photo.id,
    url: photo.url,
  }))

  const figures: MosaicTile[] = [
    {
      kind: 'figure',
      id: 'figure-members',
      icon: 'building',
      value: settings['stats.members'] ?? '500+',
      label: 'Member organisations',
    },
    {
      kind: 'figure',
      id: 'figure-tiers',
      icon: 'briefcase',
      value: String(tierCount),
      label: 'Tiers',
    },
  ]

  // A figure every fourth tile, on the same rule as the homepage: in a
  // three-column grid no two of them then share a row or stack up.
  const mosaic: MosaicTile[] = []
  let nextFigure = 0

  for (const photograph of photographs) {
    if (mosaic.length % 4 === 3 && nextFigure < figures.length) {
      mosaic.push(figures[nextFigure])
      nextFigure += 1
    }
    mosaic.push(photograph)
  }

  mosaic.push(...figures.slice(nextFigure))

  return (
    <section className="relative isolate overflow-hidden bg-ink-950 text-white">
      <Container size="wide">
        <div className="py-14 sm:py-20 lg:w-[54%] lg:py-24 lg:pr-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold-400">
            Membership
          </p>

          <h1 className="mt-6 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
            The room where Sierra Leonean business{' '}
            <span className="text-gold-400">meets the money</span>.
          </h1>

          <p className="mt-8 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            {blocks.heroLead}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink
              href="/membership/apply"
              variant="accent"
              size="lg"
              className="rounded-none font-semibold uppercase tracking-wider"
            >
              Join FBF
              <Icon name="arrowRight" className="size-5" />
            </ButtonLink>
            <ButtonLink
              href="/membership/tiers"
              size="lg"
              className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10 active:bg-white/15"
            >
              Tiers &amp; pricing
            </ButtonLink>
          </div>
        </div>
      </Container>

      <div className="relative min-h-104 bg-ink-900 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%] lg:min-h-0">
        <HeroMosaic tiles={mosaic} />
      </div>
    </section>
  )
}

// ── How it works ────────────────────────────────────────────────────────────

function HowItWorks({
  steps,
  copy,
}: {
  steps: Array<{ title: string; body: string }>
  copy: PageCopy
}) {
  if (steps.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <SectionHeading
        eyebrow={copy('stepsEyebrow', 'How it works')}
        title={copy('stepsTitle', 'Three steps, about ten minutes')}
      />

      <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {steps.map((step, index) => (
          <li key={step.title} className="border-t-2 border-ink-950 pt-6">
            <p className="font-display text-5xl font-extrabold leading-none text-gold-500">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-5 font-display text-xl font-semibold text-ink-950">
              {step.title}
            </h3>
            <p className="mt-3 leading-relaxed text-ink-700">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row">
        <ButtonLink
          href="/membership/apply"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Join FBF
        </ButtonLink>
        <ButtonLink
          href="/contact"
          variant="outline"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Make an enquiry
        </ButtonLink>
      </div>
    </Section>
  )
}

// ── What membership opens ───────────────────────────────────────────────────

type AccessItem = {
  title: string
  body: string
  href: string
  linkLabel: string
}

/**
 * "A membership gives you access to…" — the numbered band the reference page
 * runs under its three steps, with a photograph against each item.
 *
 * The photographs are the forum's own, from the `forum-gallery` collection the
 * homepage draws on. A stock photograph of a handshake beside a claim about
 * access to government would undo the claim; the secretariat's own record of
 * its engagements is the whole argument this page is making (§3.4).
 *
 * The items are CMS content — the `access` block on the membership page, the
 * same arrangement as the steps and the questions — because which three things
 * membership opens is an editorial claim and will be reworded without a
 * deployment.
 */
function AccessBand({
  items,
  photos,
  copy,
}: {
  copy: PageCopy
  items: AccessItem[]
  photos: Array<{ id: string; url: string; altText: string | null }>
}) {
  if (items.length === 0) return null

  return (
    <Section tone="muted" size="wide">
      <SectionHeading
        eyebrow={copy('accessEyebrow', 'What it opens')}
        title={copy('accessTitle', 'A membership gives you access to…')}
      />

      <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => {
          const photo = photos[index]

          return (
            <li key={item.title} className="flex flex-col">
              <div className="aspect-[4/3] overflow-hidden bg-ink-200">
                {photo && (
                  // Local file under `public/brand/hero/`, but the URL comes
                  // from the database where a later upload may be remote —
                  // see the note in ui/card.tsx.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.altText ?? ''}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                )}
              </div>

              {/* gold-700 rather than the brighter golds: at 5.2:1 on this
                  ground it is the only step of the ramp that clears AA, and a
                  numeral this size is read, not decoration. */}
              <p className="mt-5 font-display text-4xl font-extrabold leading-none text-gold-700">
                {index + 1}
              </p>

              <h3 className="mt-3 font-display text-xl font-bold text-ink-950">
                {item.title}
              </h3>

              <p className="mt-2 flex-1 text-ink-700">{item.body}</p>

              <Link
                href={item.href}
                className="mt-4 inline-flex items-center gap-1.5 self-start text-sm font-medium text-forest-700 hover:text-forest-800"
              >
                {item.linkLabel}
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

// ── Upcoming sessions ───────────────────────────────────────────────────────

/**
 * The programme, three cards of it, where the reference page runs its upcoming
 * events: between the proof and the objections, so a visitor sees what the
 * membership is *for* before being asked to pay for it.
 *
 * The card is the homepage's, shared rather than copied — see
 * `site/session-card`.
 */
function UpcomingSessions({
  sessions,
  copy,
}: {
  sessions: SessionCardSession[]
  copy: PageCopy
}) {
  if (sessions.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading
          eyebrow={copy('sessionsEyebrow', "What's on")}
          title={copy('sessionsTitle', 'Where a membership takes you')}
          lead={copy(
            'sessionsLead',
            'Members are priced into the forum at the member rate. This is the room it buys.',
          )}
          className="mb-0"
        />

        <ButtonLink href="/events/agenda" variant="outline" size="md">
          {copy('sessionsLinkLabel', 'Full agenda')}
        </ButtonLink>
      </div>

      <CardGrid columns={3} className="mt-10">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} />
        ))}
      </CardGrid>
    </Section>
  )
}

// ── Who is already in ───────────────────────────────────────────────────────

function MemberStrip({
  listings,
  copy,
}: {
  copy: PageCopy
  listings: Array<{
    id: string
    slug: string
    businessName: string
    logoUrl: string | null
  }>
}) {
  if (listings.length === 0) return null

  return (
    <Section tone="muted" size="wide">
      <SectionHeading
        eyebrow={copy('membersEyebrow', 'In membership')}
        title={copy('membersTitle', 'Who is already in the room')}
        lead={copy(
          'membersLead',
          'A sample of the organisations listed in the national business directory.',
        )}
        align="center"
      />

      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {listings.map((listing) => (
          <li key={listing.id}>
            <span className="flex min-h-20 items-center justify-center border border-ink-200 px-4 py-4 text-center text-sm font-medium text-ink-700">
              {listing.logoUrl ? (
                // Remote CMS URL — see the note in ui/card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={listing.logoUrl}
                  alt={listing.businessName}
                  loading="lazy"
                  decoding="async"
                  className="max-h-10 w-auto"
                />
              ) : (
                listing.businessName
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-10 text-center">
        <ButtonLink
          href="/directory"
          variant="outline"
          size="md"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Browse the directory
        </ButtonLink>
      </div>
    </Section>
  )
}

// ── The member rate ─────────────────────────────────────────────────────────

/**
 * The single most concrete benefit, shown as the arithmetic rather than as a
 * claim. The saving is computed from the two live ticket rows, so it cannot
 * drift out of date the way a sentence with a number in it would.
 */
function MemberRate({
  standard,
  member,
  eventName,
}: {
  standard: { name: string; priceMinor: number; currency: string }
  member: { name: string; priceMinor: number; currency: string }
  eventName: string
}) {
  const currency = (value: string) => (value === 'USD' ? 'USD' : 'SLE')
  const saving = standard.priceMinor - member.priceMinor
  const percent = Math.round((saving / standard.priceMinor) * 100)

  return (
    <Section tone="forest" size="wide">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-gold-300">
            Member rate
          </p>
          <h2 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight tracking-tight text-white sm:text-4xl">
            Members pay {percent}% less to attend
          </h2>
          <p className="mt-5 max-w-lg leading-relaxed text-white/80">
            Every registration for {eventName} is priced at the member rate for
            the whole of your membership year, for as many colleagues as you
            send. Corporate and Patron tiers include complimentary
            registrations on top.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-px overflow-hidden bg-white/20">
          <div className="bg-forest-800 p-6 sm:p-8">
            <dt className="text-sm font-medium text-white/70">
              {standard.name}
            </dt>
            <dd className="mt-2 font-display text-3xl font-bold text-white/70 line-through sm:text-4xl">
              {formatMoney(standard.priceMinor, currency(standard.currency), {
                compact: true,
              })}
            </dd>
          </div>

          <div className="bg-forest-800 p-6 sm:p-8">
            <dt className="text-sm font-medium text-gold-300">{member.name}</dt>
            <dd className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">
              {formatMoney(member.priceMinor, currency(member.currency), {
                compact: true,
              })}
            </dd>
          </div>
        </dl>
      </div>
    </Section>
  )
}
