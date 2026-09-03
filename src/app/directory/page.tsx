import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, LinkCard } from '@/components/ui/card'
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
} from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import { BUSINESS_SIZE_LABELS, SL_REGIONS, type BusinessSize } from '@/lib/enums'
import { initials, truncate } from '@/lib/format'
import { getPageCopy } from '@/lib/settings'

/**
 * Business / member directory (SDR §4.11, FR-10).
 *
 * Search plus three filters — sector, region and size — all held in the URL
 * and applied on the server. A filtered directory is the thing a member links
 * to in an email ("here are the fintechs in the Western Area"), so the state
 * has to survive being copied out of the address bar.
 *
 * Filtering that a database index can do is done in SQL; the free-text search
 * is matched in JavaScript over the page's rows for the same reason as
 * app/search/page.tsx — SQLite through Prisma cannot do a case-insensitive
 * `contains`, and a SQL filter would miss "Kamara" for someone who typed
 * "kamara". The directory is in the hundreds of rows.
 */

export const metadata: Metadata = {
  title: 'Business directory',
  description:
    'Search the Freetown Business Forum member directory by sector, region and size — Sierra Leonean businesses open to partners, buyers and investors.',
  alternates: { canonical: '/directory' },
}

const PER_PAGE = 12

const SIZES = Object.keys(BUSINESS_SIZE_LABELS) as BusinessSize[]

type Search = {
  q?: string
  sector?: string
  region?: string
  size?: string
  page?: string
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const [params, copy] = await Promise.all([
    searchParams,
    getPageCopy('directory'),
  ])

  const query = (params.q ?? '').trim()
  const needle = query.toLowerCase()

  const sectors = await db.sector.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true },
  })

  const sector = sectors.find((s) => s.slug === params.sector)
  const region = SL_REGIONS.find((r) => r === params.region)
  const size = SIZES.find((s) => s === params.size)

  const matches = await db.directoryListing.findMany({
    where: {
      isPublished: true,
      ...(sector ? { sectorId: sector.id } : {}),
      ...(region ? { region } : {}),
      ...(size ? { size } : {}),
    },
    orderBy: [{ isFeatured: 'desc' }, { businessName: 'asc' }],
    include: { sector: { select: { name: true } } },
  })

  const filtered = needle
    ? matches.filter((listing) =>
        [listing.businessName, listing.shortDescription, listing.region].some(
          (field) => field?.toLowerCase().includes(needle),
        ),
      )
    : matches

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const page = Math.min(Math.max(1, Number(params.page) || 1), pageCount)
  const visible = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  /** Rebuild the query string with one facet changed. Paging always resets. */
  const hrefWith = (changes: Partial<Search>) => {
    const next = new URLSearchParams()
    const merged: Search = { ...params, ...changes }

    if (merged.q) next.set('q', merged.q)
    if (merged.sector) next.set('sector', merged.sector)
    if (merged.region) next.set('region', merged.region)
    if (merged.size) next.set('size', merged.size)
    if (merged.page && merged.page !== '1') next.set('page', merged.page)

    const search = next.toString()
    return search ? `/directory?${search}` : '/directory'
  }

  const hasFilters = Boolean(query || sector || region || size)

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Membership', href: '/membership' },
          { label: 'Business directory', href: '/directory' },
        ]}
      />

      <PageHero
        eyebrow={copy('eyebrow', 'Membership')}
        title={copy('heroTitle', 'The business')}
        accent={copy('heroAccent', 'directory')}
        lead={copy(
          'heroLead',
          'Every FBF member is listed here. It is where a buyer, a partner or an investor looks first when they want to find a Sierra Leonean business by what it actually does.',
        )}
      >
        <ButtonLink
          href="/membership/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Get listed
          <Icon name="arrowRight" className="size-5" />
        </ButtonLink>
      </PageHero>

      {/* ── Filters ──────────────────────────────────────────────────────── */}

      <div className="border-b border-ink-200 bg-ink-50">
        <Container size="wide">
          <div className="py-6">
            {/*
              One GET form carrying every facet, so a browser without
              JavaScript can change any of them and submit. The selects have no
              onChange handler for the same reason — the Apply button is the
              submit, and it is always visible.
            */}
            <form action="/directory" method="get" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label htmlFor="dir-q" className="sr-only">
                    Search the directory
                  </label>
                  <input
                    id="dir-q"
                    name="q"
                    type="search"
                    defaultValue={query}
                    placeholder="Business name or what they do"
                    className="min-h-11 w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2 text-sm text-ink-950 placeholder:text-ink-400 focus:border-forest-600"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FacetSelect
                    id="dir-sector"
                    name="sector"
                    label="Sector"
                    defaultValue={sector?.slug ?? ''}
                    options={sectors.map((s) => ({
                      value: s.slug,
                      label: s.name,
                    }))}
                    anyLabel="All sectors"
                  />

                  <FacetSelect
                    id="dir-region"
                    name="region"
                    label="Region"
                    defaultValue={region ?? ''}
                    options={SL_REGIONS.map((r) => ({ value: r, label: r }))}
                    anyLabel="All regions"
                  />

                  <FacetSelect
                    id="dir-size"
                    name="size"
                    label="Size"
                    defaultValue={size ?? ''}
                    options={SIZES.map((s) => ({
                      value: s,
                      label: BUSINESS_SIZE_LABELS[s],
                    }))}
                    anyLabel="Any size"
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
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Filtering by
                </span>

                {query && (
                  <FilterChip href={hrefWith({ q: undefined, page: undefined })}>
                    “{query}”
                  </FilterChip>
                )}
                {sector && (
                  <FilterChip
                    href={hrefWith({ sector: undefined, page: undefined })}
                  >
                    {sector.name}
                  </FilterChip>
                )}
                {region && (
                  <FilterChip
                    href={hrefWith({ region: undefined, page: undefined })}
                  >
                    {region}
                  </FilterChip>
                )}
                {size && (
                  <FilterChip
                    href={hrefWith({ size: undefined, page: undefined })}
                  >
                    {BUSINESS_SIZE_LABELS[size]}
                  </FilterChip>
                )}

                <Link
                  href="/directory"
                  className="ml-1 text-sm font-medium text-forest-700 hover:underline"
                >
                  Clear all
                </Link>
              </div>
            )}
          </div>
        </Container>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}

      <Section tone="white" size="wide">
        <p role="status" className="text-sm font-medium text-ink-600">
          {filtered.length} business{filtered.length === 1 ? '' : 'es'}
          {pageCount > 1 && ` · page ${page} of ${pageCount}`}
        </p>

        {visible.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={copy('emptyTitle', 'No businesses match that')}
              message={copy(
                'emptyMessage',
                'Try a broader sector, or clear the filters. Not every member has published a listing yet.',
              )}
            >
              <Link
                href="/directory"
                className="font-medium text-forest-700 hover:underline"
              >
                Clear filters
              </Link>
            </EmptyState>
          </div>
        ) : (
          <>
            <CardGrid columns={3} className="mt-8">
              {visible.map((listing) => (
                <LinkCard
                  key={listing.id}
                  href={`/directory/${listing.slug}`}
                  className="h-full"
                >
                  <div className="flex items-start gap-4">
                    <ListingMark
                      logoUrl={listing.logoUrl}
                      name={listing.businessName}
                    />

                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                        {listing.businessName}
                      </h2>

                      {listing.sector && (
                        <p className="mt-1 text-sm text-forest-700">
                          {listing.sector.name}
                        </p>
                      )}
                    </div>

                    {listing.isFeatured && <Badge tone="gold">Featured</Badge>}
                  </div>

                  <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-600">
                    {truncate(listing.shortDescription, 140)}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-ink-100 pt-4">
                    {listing.region && (
                      <Badge tone="neutral">{listing.region}</Badge>
                    )}
                    {listing.size && (
                      <Badge tone="harbour">
                        {BUSINESS_SIZE_LABELS[listing.size as BusinessSize] ??
                          listing.size}
                      </Badge>
                    )}
                  </div>
                </LinkCard>
              ))}
            </CardGrid>

            {pageCount > 1 && (
              <Pagination
                page={page}
                pageCount={pageCount}
                hrefFor={(n) => hrefWith({ page: String(n) })}
              />
            )}
          </>
        )}
      </Section>

      <CtaBand
        title={copy('ctaTitle', 'Not listed yet?')}
        lead={copy(
          'ctaLead',
          'A directory listing comes with every membership tier, from the first one. It takes about ten minutes to fill in.',
        )}
      >
        <ButtonLink
          href="/membership/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Apply for membership
        </ButtonLink>
        <ButtonLink
          href="/membership/tiers"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Compare tiers
        </ButtonLink>
      </CtaBand>
    </>
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

/** An applied filter, with removing it as the link. */
function FilterChip({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-forest-600 px-3 py-1 text-sm font-medium text-white hover:bg-forest-700"
    >
      {children}
      <Icon name="close" className="size-3.5" />
      <span className="sr-only">— remove this filter</span>
    </Link>
  )
}

/** A member's logo, or an initials tile. See /about/partners for the reasoning. */
function ListingMark({
  logoUrl,
  name,
}: {
  logoUrl: string | null
  name: string
}) {
  if (logoUrl) {
    return (
      // Remote CMS URL — see the note in ui/card.tsx.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-12 shrink-0 rounded-lg bg-white object-contain ring-1 ring-ink-200"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-harbour-50 font-display text-base font-bold text-harbour-700 ring-1 ring-inset ring-harbour-100"
    >
      {initials(name)}
    </span>
  )
}
