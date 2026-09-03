import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, LinkCard, Stat, TicketSize } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  CtaBand,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import {
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from '@/lib/enums'
import { paragraphs, parseJsonColumn, truncate } from '@/lib/format'
import { getPageCopy } from '@/lib/settings'

/**
 * A sector guide (SDR §4.12 "sector pages — overview, data, incentives and
 * relevant opportunities").
 *
 * Four things in the order an investor reads them: the numbers, the case, the
 * incentives, and who is already here. The last band is what makes this more
 * than a brochure — the members and the propositions are live rows, so a
 * sector page is never further out of date than the directory is.
 */

type Params = { slug: string }

type SectorStat = { label: string; value: string }

async function getSector(slug: string) {
  return db.sector.findFirst({ where: { slug, isPublished: true } })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const sector = await getSector(slug)

  if (!sector) return { title: 'Sector not found' }

  return {
    title: sector.name,
    description: truncate(sector.summary, 200),
    alternates: { canonical: `/learning-hub/sectors/${sector.slug}` },
  }
}

export default async function SectorPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const sector = await getSector(slug)

  if (!sector) notFound()

  const [opportunities, listings, speakers, copy] = await Promise.all([
    db.opportunity.findMany({
      where: { sectorId: sector.id, isPublished: true },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        stage: true,
        currency: true,
        ticketSizeMinMinor: true,
        ticketSizeMaxMinor: true,
      },
    }),
    db.directoryListing.findMany({
      where: { sectorId: sector.id, isPublished: true },
      orderBy: [{ isFeatured: 'desc' }, { businessName: 'asc' }],
      take: 6,
      select: {
        id: true,
        slug: true,
        businessName: true,
        shortDescription: true,
      },
    }),
    db.speaker.findMany({
      where: { sectorId: sector.id, isPublished: true },
      orderBy: { sortOrder: 'asc' },
      take: 4,
      select: {
        id: true,
        slug: true,
        fullName: true,
        title: true,
        organisation: true,
      },
    }),
    // The guide shares the Learning Hub's copy — one section, one entry.
    getPageCopy('learning-hub'),
  ])

  const stats = parseJsonColumn<SectorStat[]>(sector.dataJson, [])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Learning Hub', href: '/learning-hub' },
          { label: 'Sector guides', href: '/learning-hub/sectors' },
          { label: sector.name, href: `/learning-hub/sectors/${sector.slug}` },
        ]}
      />

      <PageHero
        eyebrow={copy('guideEyebrow', 'Sector guide')}
        title={sector.name}
        lead={sector.summary}
      />

      {stats.length > 0 && (
        <Section tone="muted" size="wide" className="py-10 sm:py-12">
          <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <Stat value={stat.value} label={stat.label} />
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {sector.overview && (
        <Section tone="white" size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHeading
                eyebrow={copy('guideCaseEyebrow', 'The case')}
                title={copy('guideCaseTitle', 'Why this sector')}
              />
            </div>

            <div className="space-y-4 text-lg leading-relaxed text-ink-800 lg:col-span-8">
              {paragraphs(sector.overview).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </Section>
      )}

      {sector.incentives && (
        <Section tone="forest" size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <SectionHeading
                eyebrow={copy('guideIncentivesEyebrow', 'What is on offer')}
                title={copy('guideIncentivesTitle', 'Incentives')}
                inverted
              />
            </div>

            <div className="space-y-4 leading-relaxed text-white/85 lg:col-span-8">
              {paragraphs(sector.incentives).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}

              <p className="pt-2 text-sm text-white/60">
                Incentives change. Confirm anything you are relying on with the
                relevant agency before you commit — the{' '}
                <Link
                  href="/learning-hub/doing-business"
                  className="font-medium text-gold-300 underline"
                >
                  doing-business guide
                </Link>{' '}
                names them.
              </p>
            </div>
          </div>
        </Section>
      )}

      {/* ── Live propositions in this sector ─────────────────────────────── */}

      {opportunities.length > 0 && (
        <Section tone="white" size="wide">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow={copy('guideDealRoomEyebrow', 'Deal Room')}
              title={`${sector.name} propositions`}
              className="mb-0"
            />
            <Link
              href={`/deal-room?sector=${sector.slug}`}
              className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
            >
              See all in this sector
              <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>

          <CardGrid columns={3} className="mt-10">
            {opportunities.map((opportunity) => (
              <LinkCard
                key={opportunity.id}
                href={`/deal-room/${opportunity.slug}`}
                className="h-full"
              >
                <Badge tone="harbour">
                  {OPPORTUNITY_STAGE_LABELS[
                    opportunity.stage as OpportunityStage
                  ] ?? opportunity.stage}
                </Badge>

                <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                  {opportunity.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {truncate(opportunity.summary, 120)}
                </p>

                <div className="mt-4 border-t border-ink-100 pt-4 text-sm">
                  <TicketSize
                    min={opportunity.ticketSizeMinMinor}
                    max={opportunity.ticketSizeMaxMinor}
                    currency={opportunity.currency}
                  />
                </div>
              </LinkCard>
            ))}
          </CardGrid>
        </Section>
      )}

      {/* ── Members in this sector ───────────────────────────────────────── */}

      {listings.length > 0 && (
        <Section tone="muted" size="wide">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow={copy('guideDirectoryEyebrow', 'In the directory')}
              title={`${sector.name} members`}
              className="mb-0"
            />
            <Link
              href={`/directory?sector=${sector.slug}`}
              className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
            >
              Browse the directory
              <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>

          <CardGrid columns={3} className="mt-10">
            {listings.map((listing) => (
              <LinkCard
                key={listing.id}
                href={`/directory/${listing.slug}`}
                className="h-full"
              >
                <h3 className="font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                  {listing.businessName}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {truncate(listing.shortDescription, 120)}
                </p>
              </LinkCard>
            ))}
          </CardGrid>
        </Section>
      )}

      {/* ── Speakers on this sector ──────────────────────────────────────── */}

      {speakers.length > 0 && (
        <Section tone="white">
          <Container size="narrow" className="px-0">
            <SectionHeading
              eyebrow={copy('guideSpeakersEyebrow', 'At the forum')}
              title={`Speaking on ${sector.name.toLowerCase()}`}
            />

            <ul className="mt-8 divide-y divide-ink-200 border-y border-ink-200">
              {speakers.map((speaker) => (
                <li key={speaker.id}>
                  <Link
                    href={`/events/speakers/${speaker.slug}`}
                    className="group flex items-center justify-between gap-6 py-4"
                  >
                    <div>
                      <p className="font-medium text-ink-950 group-hover:text-forest-700">
                        {speaker.fullName}
                      </p>
                      <p className="text-sm text-ink-600">
                        {speaker.title}, {speaker.organisation}
                      </p>
                    </div>
                    <Icon
                      name="arrowRight"
                      className="size-5 shrink-0 text-forest-700"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      <CtaBand
        title={`Building something in ${sector.name.toLowerCase()}?`}
        lead={copy(
          'guideCtaLead',
          'Submit a proposition to the Deal Room, or join the forum and get listed where investors are already looking.',
        )}
      >
        <ButtonLink
          href="/deal-room/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Apply for funding
        </ButtonLink>
        <ButtonLink
          href="/membership/apply"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Become a member
        </ButtonLink>
      </CtaBand>
    </>
  )
}
