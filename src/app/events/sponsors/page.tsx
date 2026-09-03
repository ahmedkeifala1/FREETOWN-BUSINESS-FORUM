import type { Metadata } from 'next'

import { ContactForm } from '@/components/site/contact-form'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  EmptyState,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import {
  SPONSOR_TIER_LABELS,
  SPONSOR_TIER_ORDER,
  type SponsorTier,
} from '@/lib/enums'
import { initials, paragraphs } from '@/lib/format'
import { getCurrentEvent, getPageBlocks } from '@/lib/settings'

/**
 * Sponsors & exhibitors (SDR §4.7).
 *
 * Three jobs on one page, in the order a prospective sponsor needs them:
 * who already sponsors (credibility), what sponsoring gets you (the tier
 * table), and how to start the conversation (the enquiry form). Existing
 * sponsors come first deliberately — the tier table is a price list, and a
 * price list reads very differently after you have seen who else is on it.
 *
 * The enquiry form is the site-wide one with its topic pre-set, so sponsorship
 * enquiries land in the same `form_submissions` table the secretariat already
 * works from (FR-12) rather than in a second inbox nobody checks.
 */

export const metadata: Metadata = {
  title: 'Sponsors & exhibitors',
  description:
    'The organisations backing the Freetown Business Forum, what sponsorship includes, and how to become a sponsor or exhibitor.',
  alternates: { canonical: '/events/sponsors' },
}

/**
 * What each tier includes.
 *
 * Held in code rather than the database because it is the shape of the table,
 * not its copy: adding a row means adding a column of ticks, which is a layout
 * change. The prospectus PDF remains the contractual document — this table is
 * the summary that gets someone to download it, and it says so.
 */
const TIER_BENEFITS: Array<{
  label: string
  tiers: Partial<Record<SponsorTier, string | boolean>>
}> = [
  {
    label: 'Logo on the forum website',
    tiers: { PLATINUM: true, GOLD: true, SILVER: true, BRONZE: true },
  },
  {
    label: 'Logo on stage and event signage',
    tiers: { PLATINUM: true, GOLD: true, SILVER: true },
  },
  {
    label: 'Delegate passes included',
    tiers: { PLATINUM: '10', GOLD: '6', SILVER: '3', BRONZE: '1' },
  },
  {
    label: 'Exhibition stand',
    tiers: { PLATINUM: 'Premium', GOLD: 'Standard', SILVER: 'Shared' },
  },
  {
    label: 'Speaking slot on the programme',
    tiers: { PLATINUM: 'Plenary', GOLD: 'Panel' },
  },
  {
    label: 'Branded roundtable or workshop',
    tiers: { PLATINUM: true },
  },
  {
    label: 'Deal Room introductions arranged by the secretariat',
    tiers: { PLATINUM: true, GOLD: true },
  },
  {
    label: 'Delegate list (opted-in contacts only)',
    tiers: { PLATINUM: true, GOLD: true },
  },
  {
    label: 'Full-page advert in the programme',
    tiers: { PLATINUM: true, GOLD: true, SILVER: 'Half page' },
  },
]

/** Only the paid tiers appear in the comparison; partners are not a price. */
const PRICED_TIERS: SponsorTier[] = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE']

export default async function SponsorsPage() {
  const event = await getCurrentEvent()

  const [sponsors, blocks] = await Promise.all([
    event
      ? db.sponsor.findMany({
          where: { eventId: event.id, isPublished: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
      : Promise.resolve([]),
    getPageBlocks('sponsorship'),
  ])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Events', href: '/events' },
          { label: 'Sponsors', href: '/events/sponsors' },
        ]}
      />

      <PageHero
        eyebrow={blocks.eyebrow ?? 'Events'}
        title={blocks.heroTitle ?? 'Sponsors &'}
        accent={blocks.heroAccent ?? 'exhibitors'}
        lead={
          blocks.heroLead ??
          'The forum is delivered with the backing of organisations that want Sierra Leonean business to be met on its own terms. Here is who they are, and how to join them.'
        }
      >
        <a
          href="#become-a-sponsor"
          className="inline-flex min-h-12 items-center justify-center gap-2 bg-gold-600 px-6 py-3 text-base font-semibold uppercase tracking-wider text-white hover:bg-gold-700"
        >
          Become a sponsor
          <Icon name="arrowRight" className="size-5" />
        </a>

        {event?.prospectusUrl && (
          <a
            href={event.prospectusUrl}
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/40 px-6 py-3 text-base font-semibold uppercase tracking-wider text-white hover:bg-white/10"
          >
            <Icon name="download" className="size-5" />
            Sponsorship prospectus
          </a>
        )}
      </PageHero>

      {/* ── Who already sponsors ─────────────────────────────────────────── */}

      {sponsors.length === 0 ? (
        <Section tone="white">
          <EmptyState
            title={
              blocks.emptyTitle ??
              'Sponsors for this edition are being confirmed'
            }
            message={
              blocks.emptyMessage ??
              'Packages are open. Talk to the secretariat about where your organisation fits.'
            }
          >
            <ButtonLink href="#become-a-sponsor" variant="primary">
              {blocks.emptyLinkLabel ?? 'Enquire about sponsorship'}
            </ButtonLink>
          </EmptyState>
        </Section>
      ) : (
        SPONSOR_TIER_ORDER.map((tier, index) => {
          const group = sponsors.filter((sponsor) => sponsor.tier === tier)
          if (group.length === 0) return null

          // The top tier gets bigger tiles: that size difference is most of
          // what a platinum sponsor is paying for.
          const isHeadline = index === 0

          return (
            <Section
              key={tier}
              tone={index % 2 === 0 ? 'white' : 'muted'}
              size="wide"
            >
              <SectionHeading
                eyebrow={index === 0 ? 'With the support of' : undefined}
                title={`${SPONSOR_TIER_LABELS[tier]} sponsor${
                  group.length === 1 ? '' : 's'
                }`}
              />

              <CardGrid
                columns={isHeadline ? 2 : 4}
                className={cn('mt-8', isHeadline && 'lg:grid-cols-2')}
              >
                {group.map((sponsor) => (
                  <Card key={sponsor.id} className="flex h-full flex-col">
                    <SponsorMark
                      logoUrl={sponsor.logoUrl}
                      name={sponsor.name}
                      large={isHeadline}
                    />

                    <h3
                      className={cn(
                        'mt-5 font-display font-semibold leading-snug text-ink-950',
                        isHeadline ? 'text-lg sm:text-xl' : 'text-base',
                      )}
                    >
                      {sponsor.name}
                    </h3>

                    {sponsor.description && (
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                        {sponsor.description}
                      </p>
                    )}

                    {sponsor.website && (
                      <a
                        href={sponsor.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
                      >
                        Visit website
                        <Icon name="arrowRight" className="size-4" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}
                  </Card>
                ))}
              </CardGrid>
            </Section>
          )
        })
      )}

      {/* ── Why sponsor ──────────────────────────────────────────────────── */}

      <Section tone="forest" size="wide">
        <SectionHeading
          eyebrow={blocks.whyEyebrow ?? 'Why sponsor'}
          title={blocks.whyTitle ?? 'What sponsorship actually buys'}
          lead={
            blocks.why ??
            'Not a logo on a banner. Sponsorship puts your organisation in front of the people who decide where capital and contracts go in Sierra Leone, in a room they have travelled to be in.'
          }
          inverted
        />

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Benefit
            icon="users"
            title="The right room"
            body="Ministers, regulators, financiers and the founders of the country’s fastest-growing firms, over consecutive days."
          />
          <Benefit
            icon="handshake"
            title="Introductions, not stands"
            body="The secretariat arranges named meetings for headline sponsors rather than leaving you to work the aisles."
          />
          <Benefit
            icon="trending"
            title="Association with delivery"
            body="The forum publishes what came out of each edition. Sponsors are named in that record."
          />
          <Benefit
            icon="globe"
            title="Reach beyond the room"
            body="Programme, website, press coverage and the session recordings that stay online afterwards."
          />
        </div>
      </Section>

      {/* ── Tier comparison ──────────────────────────────────────────────── */}

      <Section tone="white" size="wide">
        <SectionHeading
          eyebrow={blocks.packagesEyebrow ?? 'Packages'}
          title={blocks.packagesTitle ?? 'What each tier includes'}
          lead={
            blocks.packagesLead ??
            'A summary. The prospectus carries the full specification, the prices and the terms — and it is the document that governs.'
          }
        />

        {/*
          The table scrolls inside its own container on a phone rather than
          forcing the page sideways (§4.17 "tables become stacked/scrollable
          on small screens").
        */}
        <div className="mt-10 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">
              Sponsorship tiers and what each includes
            </caption>

            <thead>
              <tr className="border-b-2 border-ink-950">
                <th scope="col" className="py-4 pr-4 text-sm font-semibold text-ink-950">
                  Included
                </th>
                {PRICED_TIERS.map((tier) => (
                  <th
                    key={tier}
                    scope="col"
                    className="px-3 py-4 text-center font-display text-sm font-semibold uppercase tracking-wider text-ink-950"
                  >
                    {SPONSOR_TIER_LABELS[tier]}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {TIER_BENEFITS.map((benefit) => (
                <tr key={benefit.label} className="border-b border-ink-200">
                  <th
                    scope="row"
                    className="py-4 pr-4 text-sm font-normal text-ink-700"
                  >
                    {benefit.label}
                  </th>

                  {PRICED_TIERS.map((tier) => (
                    <td key={tier} className="px-3 py-4 text-center">
                      <TierCell value={benefit.tiers[tier]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {event?.prospectusUrl ? (
            <a
              href={event.prospectusUrl}
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-gold-600 px-6 py-3 text-base font-semibold uppercase tracking-wider text-white hover:bg-gold-700"
            >
              <Icon name="download" className="size-5" />
              Download the prospectus
            </a>
          ) : (
            <p className="text-sm text-ink-600">
              The prospectus for this edition is being finalised. Ask for it in
              the form below and it will be sent as soon as it is ready.
            </p>
          )}
        </div>
      </Section>

      {/* ── Exhibiting ───────────────────────────────────────────────────── */}

      <Section tone="muted" size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              eyebrow={blocks.exhibitingEyebrow ?? 'Exhibiting'}
              title={blocks.exhibitingTitle ?? 'Take a stand'}
            />
          </div>

          <div className="space-y-4 leading-relaxed text-ink-700 lg:col-span-7">
            {blocks.exhibiting ? (
              paragraphs(blocks.exhibiting).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))
            ) : (
              <>
                <p>
                  The exhibition runs alongside the programme, in the space
                  delegates pass through between sessions and over lunch. Stands
                  are sold separately from sponsorship, and every sponsorship
                  tier above bronze includes one.
                </p>
                <p>
                  Stands suit organisations with something to demonstrate — a
                  product, a service, a financing facility, an investment
                  promotion offer. Numbers are limited by the venue, and they go
                  in the order they are confirmed.
                </p>
              </>
            )}

            <p>
              To reserve one, use the form below and choose{' '}
              <strong>Exhibiting</strong> as the topic.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Enquiry ──────────────────────────────────────────────────────── */}

      <Section tone="white" id="become-a-sponsor" className="scroll-mt-24">
        <Container size="narrow" className="px-0">
          <SectionHeading
            eyebrow={blocks.enquiryEyebrow ?? 'Get in touch'}
            title={blocks.enquiryTitle ?? 'Become a sponsor'}
            lead={
              blocks.enquiryLead ??
              'Tell us what you want out of the forum and the secretariat will come back with the package that fits — usually within two working days.'
            }
          />

          <div className="mt-10">
            <ContactForm defaultTopic="SPONSOR_ENQUIRY" />
          </div>
        </Container>
      </Section>
    </>
  )
}

function Benefit({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  return (
    <div>
      <Icon name={icon} className="size-8 text-gold-300" />
      <h3 className="mt-4 font-display text-base font-semibold text-white">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/75">{body}</p>
    </div>
  )
}

/**
 * One cell of the tier table.
 *
 * A tick needs a text alternative — a column of bare ✓ glyphs is unreadable to
 * a screen reader and ambiguous to everyone else once the row header has
 * scrolled off. "Included" / "Not included" is announced; the mark is drawn.
 */
function TierCell({ value }: { value: string | boolean | undefined }) {
  if (value === true) {
    return (
      <>
        <Icon
          name="check"
          className="mx-auto size-5 text-forest-600"
          aria-hidden="true"
        />
        <span className="sr-only">Included</span>
      </>
    )
  }

  if (typeof value === 'string') {
    return <span className="text-sm font-medium text-ink-900">{value}</span>
  }

  return (
    <>
      <span aria-hidden="true" className="text-ink-300">
        —
      </span>
      <span className="sr-only">Not included</span>
    </>
  )
}

/** A sponsor's logo, contained rather than cropped. See /about/partners. */
function SponsorMark({
  logoUrl,
  name,
  large,
}: {
  logoUrl: string | null
  name: string
  large: boolean
}) {
  const box = large ? 'h-20' : 'h-14'

  if (logoUrl) {
    return (
      <div className={cn('flex items-center', box)}>
        {/* Remote CMS URL — see the note in ui/card.tsx. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className={cn('w-auto max-w-[70%] object-contain', large ? 'max-h-20' : 'max-h-14')}
        />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex aspect-square items-center justify-center rounded-lg bg-forest-50 font-display font-bold text-forest-700 ring-1 ring-inset ring-forest-100',
        large ? 'h-20 text-2xl' : 'h-14 text-lg',
      )}
    >
      {initials(name)}
    </div>
  )
}
