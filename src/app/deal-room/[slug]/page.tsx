import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { InvestorAccessForm } from '@/components/site/investor-access-form'
import { ButtonLink } from '@/components/ui/button'
import { Badge, Card, TicketSize } from '@/components/ui/card'
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
import {
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from '@/lib/enums'
import { formatDate, paragraphs, truncate } from '@/lib/format'

/**
 * One Deal Room proposition (SDR §4.12 "→ project detail pages").
 *
 * Two halves: the proposition on the left, the access request on the right.
 * The form sits beside the pitch rather than under it because an investor
 * decides to ask somewhere in the middle of reading, and making them scroll
 * back past what convinced them is how a request gets lost.
 *
 * What is on this page is everything the business agreed to publish. The
 * financials, the documents and the named contact are released per request —
 * see the note on /deal-room. Nothing gated is fetched here.
 */

type Params = { slug: string }

async function getOpportunity(slug: string) {
  return db.opportunity.findFirst({
    where: { slug, isPublished: true },
    include: {
      sector: { select: { slug: true, name: true } },
      member: {
        select: {
          organisationName: true,
          listing: { select: { slug: true, isPublished: true } },
        },
      },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const opportunity = await getOpportunity(slug)

  if (!opportunity) return { title: 'Opportunity not found' }

  return {
    title: opportunity.title,
    description: truncate(opportunity.summary, 200),
    alternates: { canonical: `/deal-room/${opportunity.slug}` },
    openGraph: {
      type: 'article',
      title: opportunity.title,
      description: truncate(opportunity.summary, 200),
      images: opportunity.heroImageUrl ? [opportunity.heroImageUrl] : undefined,
    },
  }
}

export default async function OpportunityPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const opportunity = await getOpportunity(slug)

  if (!opportunity) notFound()

  const related = opportunity.sectorId
    ? await db.opportunity.findMany({
        where: {
          isPublished: true,
          sectorId: opportunity.sectorId,
          NOT: { id: opportunity.id },
        },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          stage: true,
        },
      })
    : []

  const listing =
    opportunity.member?.listing?.isPublished === true
      ? opportunity.member.listing
      : null

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Deal Room', href: '/deal-room' },
          { label: opportunity.title, href: `/deal-room/${opportunity.slug}` },
        ]}
      />

      <section className="bg-ink-950 text-white">
        <Container size="wide" className="py-12 sm:py-16">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              {opportunity.sector && (
                <Link
                  href={`/deal-room?sector=${opportunity.sector.slug}`}
                  className="text-sm font-semibold uppercase tracking-widest text-gold-400 hover:underline"
                >
                  {opportunity.sector.name}
                </Link>
              )}
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm text-white/85">
                {OPPORTUNITY_STAGE_LABELS[
                  opportunity.stage as OpportunityStage
                ] ?? opportunity.stage}
              </span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {opportunity.title}
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-white/80">
              {opportunity.summary}
            </p>

            {opportunity.publishedAt && (
              <p className="mt-6 text-sm text-white/55">
                Published {formatDate(opportunity.publishedAt)}
              </p>
            )}
          </div>
        </Container>
      </section>

      <Section tone="white" size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ── The proposition ────────────────────────────────────────── */}

          <div className="lg:col-span-7">
            {/* The facts an investor screens on, before any prose. */}
            <dl className="grid gap-6 border-y border-ink-200 py-6 sm:grid-cols-3">
              <Fact label="Seeking">
                <TicketSize
                  min={opportunity.ticketSizeMinMinor}
                  max={opportunity.ticketSizeMaxMinor}
                  currency={opportunity.currency}
                />
                {!opportunity.ticketSizeMinMinor &&
                  !opportunity.ticketSizeMaxMinor && (
                    <span className="text-ink-600">On application</span>
                  )}
              </Fact>

              <Fact label="Stage">
                <span className="font-medium text-ink-950">
                  {OPPORTUNITY_STAGE_LABELS[
                    opportunity.stage as OpportunityStage
                  ] ?? opportunity.stage}
                </span>
              </Fact>

              <Fact label="Region">
                <span className="font-medium text-ink-950">
                  {opportunity.region ?? 'Sierra Leone'}
                </span>
              </Fact>
            </dl>

            {opportunity.description && (
              <div className="mt-10">
                <h2 className="text-2xl text-ink-950 sm:text-3xl">
                  The opportunity
                </h2>
                <div className="mt-5 space-y-4 leading-relaxed text-ink-700">
                  {paragraphs(opportunity.description).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {opportunity.useOfFunds && (
              <div className="mt-10">
                <h2 className="text-2xl text-ink-950 sm:text-3xl">
                  Use of funds
                </h2>
                <div className="mt-5 space-y-4 leading-relaxed text-ink-700">
                  {paragraphs(opportunity.useOfFunds).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {opportunity.member && (
              <div className="mt-10 border-t border-ink-200 pt-8">
                <h2 className="text-xl text-ink-950">Behind the proposition</h2>
                <p className="mt-3 leading-relaxed text-ink-700">
                  Submitted by{' '}
                  <strong>{opportunity.member.organisationName}</strong>, a
                  member of the Freetown Business Forum.
                </p>

                {listing && (
                  <Link
                    href={`/directory/${listing.slug}`}
                    className="mt-3 inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
                  >
                    See their directory profile
                    <Icon name="arrowRight" className="size-4" />
                  </Link>
                )}
              </div>
            )}

            {/*
              What is deliberately not on the page. Saying so is what stops an
              investor concluding the proposition is thin — it is redacted, and
              the redaction is the member's decision, not an omission.
            */}
            <div className="mt-10 flex gap-3 rounded-xl bg-ink-50 p-5">
              <Icon
                name="shield"
                className="mt-0.5 size-5 shrink-0 text-ink-500"
              />
              <div>
                <p className="text-sm font-medium text-ink-900">
                  Financials and documents are released on request
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">
                  Accounts, projections, the full business plan and a named
                  contact are held by the secretariat and passed on when the
                  business agrees to your request. Use the form to ask.
                </p>
              </div>
            </div>
          </div>

          {/* ── Request access ─────────────────────────────────────────── */}

          <div id="request-access" className="scroll-mt-24 lg:col-span-5">
            <Card className="lg:sticky lg:top-24">
              <h2 className="font-display text-lg font-semibold text-ink-950">
                Request access
              </h2>

              <div className="mt-5">
                <InvestorAccessForm
                  opportunityId={opportunity.id}
                  opportunityTitle={opportunity.title}
                />
              </div>
            </Card>
          </div>
        </div>
      </Section>

      {related.length > 0 && opportunity.sector && (
        <Section tone="muted" size="wide">
          <SectionHeading
            eyebrow="Same sector"
            title={`Other ${opportunity.sector.name.toLowerCase()} propositions`}
          />

          <CardGrid columns={3} className="mt-10">
            {related.map((other) => (
              <Link
                key={other.id}
                href={`/deal-room/${other.slug}`}
                className="group flex h-full flex-col rounded-xl border border-ink-200 bg-white p-5 shadow-sm transition hover:border-forest-300 hover:shadow-md sm:p-6"
              >
                <Badge tone="harbour">
                  {OPPORTUNITY_STAGE_LABELS[other.stage as OpportunityStage] ??
                    other.stage}
                </Badge>
                <h3 className="mt-2.5 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                  {other.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {truncate(other.summary, 120)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                  See the proposition
                  <Icon name="arrowRight" className="size-4" />
                </span>
              </Link>
            ))}
          </CardGrid>
        </Section>
      )}

      <CtaBand
        title="Looking for capital yourself?"
        lead="Propositions in the Deal Room started as an application. Yours can too."
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
          href="/deal-room"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Back to the Deal Room
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  )
}
