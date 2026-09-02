import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, LinkCard, Stat, TicketSize } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  CtaBand,
  EmptyState,
  PageHero,
  Pagination,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import {
  OPPORTUNITY_STAGE_LABELS,
  SL_REGIONS,
  type OpportunityStage,
} from '@/lib/enums'
import { truncate } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'

/**
 * Invest & Do Business — the Deal Room (SDR §4.12, FR-15).
 *
 * The differentiator the benchmark section calls out (§2): a filterable list
 * of real propositions with two doors off it — businesses submitting, and
 * investors asking to see. Both doors are named in the hero rather than buried
 * at the bottom, because the two audiences arrive on this page from completely
 * different places and neither should have to read the other's pitch first.
 *
 * Filters are server-side and held in the URL, as everywhere else on the site:
 * "energy propositions in the Northern Province seeking over half a million"
 * is a link the secretariat sends to a fund.
 */

export const metadata: Metadata = {
  title: 'Deal Room',
  description:
    'Investment propositions from Sierra Leonean businesses — filter by sector, region and stage, or submit a proposition of your own.',
  alternates: { canonical: '/deal-room' },
}

const PER_PAGE = 9

const STAGES = Object.keys(
  OPPORTUNITY_STAGE_LABELS,
) as OpportunityStage[]

type Search = {
  q?: string
  sector?: string
  region?: string
  stage?: string
  page?: string
}

export default async function DealRoomPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const params = await searchParams

  const query = (params.q ?? '').trim()
  const needle = query.toLowerCase()

  const sectors = await db.sector.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true },
  })

  const sector = sectors.find((s) => s.slug === params.sector)
  const region = SL_REGIONS.find((r) => r === params.region)
  const stage = STAGES.find((s) => s === params.stage)

  const [matches, totalCount] = await Promise.all([
    db.opportunity.findMany({
      where: {
        isPublished: true,
        ...(sector ? { sectorId: sector.id } : {}),
        ...(region ? { region } : {}),
        ...(stage ? { stage } : {}),
      },
      orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
      include: {
        sector: { select: { name: true } },
        member: { select: { organisationName: true } },
      },
    }),
    db.opportunity.count({ where: { isPublished: true } }),
  ])

  const filtered = needle
    ? matches.filter((opportunity) =>
        [opportunity.title, opportunity.summary, opportunity.region].some(
          (field) => field?.toLowerCase().includes(needle),
        ),
      )
    : matches

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount)
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const hrefWith = (changes: Partial<Search>) => {
    const next = new URLSearchParams()
    const merged: Search = { ...params, ...changes }

    if (merged.q) next.set('q', merged.q)
    if (merged.sector) next.set('sector', merged.sector)
    if (merged.region) next.set('region', merged.region)
    if (merged.stage) next.set('stage', merged.stage)
    if (merged.page && merged.page !== '1') next.set('page', merged.page)

    const search = next.toString()
    return search ? `/deal-room?${search}` : '/deal-room'
  }

  const hasFilters = Boolean(query || sector || region || stage)

  // The headline figure. Summed across published propositions in a single
  // currency only — adding Leones to dollars would produce a number that is
  // wrong in both, so mixed sets fall back to showing nothing.
  const currencies = new Set(matches.map((o) => o.currency))
  const totalSought =
    currencies.size === 1
      ? matches.reduce((sum, o) => sum + (o.ticketSizeMaxMinor ?? 0), 0)
      : null
  const totalCurrency = [...currencies][0]

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Deal Room', href: '/deal-room' },
        ]}
      />

      <PageHero
        eyebrow="Invest & do business"
        title="The Deal"
        accent="Room"
        lead="Sierra Leonean businesses looking for capital, and the investors looking for them. Every proposition here has been through the secretariat before it was published."
      >
        <ButtonLink
          href="/deal-room/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Apply for funding
          <Icon name="arrowRight" className="size-5" />
        </ButtonLink>
        <a
          href="#opportunities"
          className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/40 px-6 py-3 text-base font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Browse propositions
        </a>
      </PageHero>

      {/* ── How it works ─────────────────────────────────────────────────── */}

      <Section tone="white" size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <SectionHeading
              eyebrow="How it works"
              title="Two doors into the same room"
            />

            <dl className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <dt className="sr-only">Published propositions</dt>
                <dd>
                  <Stat
                    value={String(totalCount)}
                    label="propositions published"
                  />
                </dd>
              </div>

              {totalSought !== null && totalSought > 0 && (
                <div>
                  <dt className="sr-only">Total capital sought</dt>
                  <dd>
                    <Stat
                      value={formatMoney(
                        totalSought,
                        isCurrency(totalCurrency) ? totalCurrency : 'USD',
                        { compact: true },
                      )}
                      label="capital sought in total"
                    />
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:col-span-7">
            <Door
              icon="trending"
              title="You have a business"
              body="Submit a proposition: what the business does, what it needs and what the money is for. The secretariat assesses it before anything is published, then lists it here for investors to find."
              cta={{ label: 'Apply for funding', href: '/deal-room/apply' }}
            />
            <Door
              icon="handshake"
              title="You have capital"
              body="Browse the propositions below. The summary, the sector and the ticket size are public; the full pack is released when the business behind it agrees to your request."
              cta={{ label: 'Browse propositions', href: '#opportunities' }}
            />
          </div>
        </div>
      </Section>

      {/* ── Filters ──────────────────────────────────────────────────────── */}

      <div
        id="opportunities"
        className="scroll-mt-4 border-y border-ink-200 bg-ink-50"
      >
        <Container size="wide">
          <div className="py-6">
            <form action="/deal-room" method="get" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label htmlFor="deal-q" className="sr-only">
                    Search propositions
                  </label>
                  <input
                    id="deal-q"
                    name="q"
                    type="search"
                    defaultValue={query}
                    placeholder="Search propositions"
                    className="min-h-11 w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-sm text-ink-950 placeholder:text-ink-400 focus:border-forest-600"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FacetSelect
                    id="deal-sector"
                    name="sector"
                    label="Sector"
                    defaultValue={sector?.slug ?? ''}
                    anyLabel="All sectors"
                    options={sectors.map((s) => ({
                      value: s.slug,
                      label: s.name,
                    }))}
                  />
                  <FacetSelect
                    id="deal-region"
                    name="region"
                    label="Region"
                    defaultValue={region ?? ''}
                    anyLabel="All regions"
                    options={SL_REGIONS.map((r) => ({ value: r, label: r }))}
                  />
                  <FacetSelect
                    id="deal-stage"
                    name="stage"
                    label="Stage"
                    defaultValue={stage ?? ''}
                    anyLabel="Any stage"
                    options={STAGES.map((s) => ({
                      value: s,
                      label: OPPORTUNITY_STAGE_LABELS[s],
                    }))}
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-forest-600 px-5 text-sm font-medium text-white hover:bg-forest-700"
                >
                  <Icon name="search" className="size-4" />
                  Apply
                </button>
              </div>
            </form>

            {hasFilters && (
              <p className="mt-4 text-sm text-ink-600">
                Showing filtered results.{' '}
                <Link
                  href="/deal-room"
                  className="font-medium text-forest-700 hover:underline"
                >
                  Clear all filters
                </Link>
              </p>
            )}
          </div>
        </Container>
      </div>

      {/* ── Propositions ─────────────────────────────────────────────────── */}

      <Section tone="white" size="wide">
        <p role="status" className="text-sm font-medium text-ink-600">
          {filtered.length} proposition{filtered.length === 1 ? '' : 's'}
          {pageCount > 1 && ` · page ${page} of ${pageCount}`}
        </p>

        {visible.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={
                hasFilters
                  ? 'No propositions match that'
                  : 'No propositions published yet'
              }
              message={
                hasFilters
                  ? 'Try a broader sector or stage, or clear the filters.'
                  : 'Propositions are published once the secretariat has assessed them. If you are looking for capital, start with an application.'
              }
            >
              {hasFilters ? (
                <Link
                  href="/deal-room"
                  className="font-medium text-forest-700 hover:underline"
                >
                  Clear filters
                </Link>
              ) : (
                <ButtonLink href="/deal-room/apply" variant="primary">
                  Apply for funding
                </ButtonLink>
              )}
            </EmptyState>
          </div>
        ) : (
          <>
            <CardGrid columns={3} className="mt-8">
              {visible.map((opportunity) => (
                <LinkCard
                  key={opportunity.id}
                  href={`/deal-room/${opportunity.slug}`}
                  className="h-full"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {opportunity.sector && (
                      <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                        {opportunity.sector.name}
                      </span>
                    )}
                    <Badge tone="harbour">
                      {OPPORTUNITY_STAGE_LABELS[
                        opportunity.stage as OpportunityStage
                      ] ?? opportunity.stage}
                    </Badge>
                  </div>

                  <h2 className="mt-2.5 font-display text-lg font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                    {opportunity.title}
                  </h2>

                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                    {truncate(opportunity.summary, 150)}
                  </p>

                  <dl className="mt-5 space-y-2 border-t border-ink-100 pt-4 text-sm">
                    <TicketSize
                      min={opportunity.ticketSizeMinMinor}
                      max={opportunity.ticketSizeMaxMinor}
                      currency={opportunity.currency}
                    />

                    {opportunity.region && (
                      <div className="flex items-center gap-1.5 text-ink-600">
                        <Icon name="pin" className="size-4 shrink-0" />
                        <span>{opportunity.region}</span>
                      </div>
                    )}
                  </dl>

                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                    See the proposition
                    <Icon name="arrowRight" className="size-4" />
                  </span>
                </LinkCard>
              ))}
            </CardGrid>

            <Pagination
              page={page}
              pageCount={pageCount}
              hrefFor={(n) => hrefWith({ page: String(n) })}
            />
          </>
        )}
      </Section>

      {/* ── What gets published ──────────────────────────────────────────── */}

      <Section tone="muted">
        <Container size="narrow" className="px-0">
          <SectionHeading
            eyebrow="Before you submit"
            title="What is public and what is not"
          />

          <div className="mt-6 space-y-4 leading-relaxed text-ink-700">
            <p>
              A published proposition shows the title, the sector, the region,
              the stage, the ticket size and the summary you write. That is
              enough for an investor to decide whether to ask for more, and not
              enough to hand a competitor your plan.
            </p>
            <p>
              Financial detail, documents and named contacts stay with the
              secretariat until you approve a specific access request. Every
              request names the investor and their organisation, and you decide.
            </p>
            <p>
              Submitting an application does not guarantee a listing. The
              secretariat assesses each one, and comes back to you either way.
            </p>
          </div>
        </Container>
      </Section>

      <CtaBand
        title="Looking for capital?"
        lead="The application takes about twenty minutes and needs no account. You will get a reference number to quote."
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
          href="/membership"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Member priority listing
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function Door({
  icon,
  title,
  body,
  cta,
}: {
  icon: string
  title: string
  body: string
  cta: { label: string; href: string }
}) {
  return (
    <div className="flex flex-col border-t-2 border-ink-950 pt-6">
      <Icon name={icon} className="size-8 text-forest-600" />
      <h3 className="mt-4 font-display text-lg font-semibold text-ink-950">
        {title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{body}</p>
      <Link
        href={cta.href}
        className="mt-4 inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
      >
        {cta.label}
        <Icon name="arrowRight" className="size-4" />
      </Link>
    </div>
  )
}

function FacetSelect({
  id,
  name,
  label,
  defaultValue,
  options,
  anyLabel,
}: {
  id: string
  name: string
  label: string
  defaultValue: string
  options: Array<{ value: string; label: string }>
  anyLabel: string
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-950 focus:border-forest-600"
      >
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
