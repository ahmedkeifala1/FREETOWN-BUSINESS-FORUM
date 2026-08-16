import type { Metadata } from 'next'

import { Faq, type FaqItem } from '@/components/site/faq'
import { HeroMosaic, type MosaicTile } from '@/components/site/hero-mosaic'
import {
  MembershipTabs,
  type MembershipTab,
} from '@/components/site/membership-tabs'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  CtaBand,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { parseJsonColumn } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { getCurrentEvent, getPageBlocks, getSettings } from '@/lib/settings'

/**
 * Membership — why join, what it costs, and what it gets you (SDR §4.10).
 *
 * Laid out to the reference page the secretariat gave us
 * (londonbusinessforum.com/membership): a statement hero, the process in three
 * numbered steps, the benefits as tabs rather than a wall of price cards,
 * proof in the form of the organisations already in membership, then the
 * money, then the objections answered in an accordion.
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
  const [settings, blocks, event, tiers, listings] = await Promise.all([
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
  ])

  // The two rates the value proposition turns on. Fetched by slug rather than
  // by price order — "the cheapest ticket" and "the member ticket" are not the
  // same thing, and the student rate would win that comparison.
  const ticketTypes = event
    ? await db.ticketType.findMany({
        where: { eventId: event.id, isActive: true, slug: { in: ['standard', 'member'] } },
        select: { slug: true, name: true, priceMinor: true, currency: true },
      })
    : []

  const standardRate = ticketTypes.find((ticket) => ticket.slug === 'standard')
  const memberRate = ticketTypes.find((ticket) => ticket.slug === 'member')

  const steps = parseJsonColumn<Array<{ title: string; body: string }>>(
    blocks.steps ?? null,
    [],
  )
  const faqs = parseJsonColumn<FaqItem[]>(blocks.faq ?? null, [])

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
        listings={listings}
      />

      <HowItWorks steps={steps} />

      <Section tone="muted" size="wide">
        <SectionHeading
          eyebrow="What you get"
          title="Four tiers, one membership"
          lead={blocks.intro}
          align="center"
        />
        <MembershipTabs tabs={tabs} />
      </Section>

      <MemberStrip listings={listings} />

      {standardRate && memberRate && (
        <MemberRate
          standard={standardRate}
          member={memberRate}
          eventName={event?.name ?? 'the forum'}
        />
      )}

      <Section tone="white" size="wide">
        <SectionHeading
          eyebrow="Questions"
          title="Before you apply"
          lead="The things the secretariat is asked most often. If yours is not here, the contact form reaches a person, not a queue."
        />
        <Faq items={faqs} />
      </Section>

      <CtaBand
        title="Join FBF"
        lead="Applications are decided within five working days. You can save the form and come back to it."
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
  listings,
}: {
  blocks: Record<string, string>
  settings: Record<string, string>
  tierCount: number
  listings: Array<{ id: string; businessName: string; logoUrl: string | null }>
}) {
  const tiles: MosaicTile[] = [
    ...listings.slice(0, 8).map(
      (listing): MosaicTile => ({
        kind: 'speaker',
        id: listing.id,
        name: listing.businessName,
        photoUrl: listing.logoUrl,
      }),
    ),
  ]

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

  // A figure every fourth tile, as on the homepage.
  const mosaic: MosaicTile[] = []
  for (const [index, tile] of tiles.entries()) {
    if (index === 3 && figures[0]) mosaic.push(figures[0])
    if (index === 7 && figures[1]) mosaic.push(figures[1])
    mosaic.push(tile)
  }

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

function HowItWorks({ steps }: { steps: Array<{ title: string; body: string }> }) {
  if (steps.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <SectionHeading
        eyebrow="How it works"
        title="Three steps, about ten minutes"
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

// ── Who is already in ───────────────────────────────────────────────────────

function MemberStrip({
  listings,
}: {
  listings: Array<{
    id: string
    slug: string
    businessName: string
    logoUrl: string | null
  }>
}) {
  if (listings.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <SectionHeading
        eyebrow="In membership"
        title="Who is already in the room"
        lead="A sample of the organisations listed in the national business directory."
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
