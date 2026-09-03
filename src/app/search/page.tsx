import Link from 'next/link'
import type { Metadata } from 'next'

import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  EmptyState,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { truncate } from '@/lib/format'
import { getPageCopy } from '@/lib/settings'

/**
 * Site search.
 *
 * A GET form to this same page rather than a scripted overlay: the query lives
 * in the URL, so a result set can be bookmarked, shared and reloaded, and the
 * whole thing works before hydration.
 *
 * Matching is done in JavaScript over the rows rather than in SQL. SQLite's
 * LIKE is case-sensitive for non-ASCII and Prisma cannot ask it for a
 * case-insensitive `contains` on this provider, so a SQL filter would silently
 * miss "Agriculture" for someone who typed "agriculture". The corpus here is a
 * few hundred rows; when it outgrows that it wants a real index, not a
 * cleverer query.
 */

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search the Freetown Business Forum — articles, speakers, sectors and the business directory.',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true },
}

type Result = {
  key: string
  kind: string
  title: string
  summary: string
  href: string
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [{ q }, copy] = await Promise.all([searchParams, getPageCopy('search')])
  const query = (q ?? '').trim()

  const results = query.length >= 2 ? await search(query) : []

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Search', href: '/search' },
        ]}
      />

      <PageHero
        eyebrow={copy('eyebrow', 'Search')}
        title={copy('heroTitle', 'Find it on')}
        accent={copy('heroAccent', 'FBF')}
      >
        <form action="/search" method="get" className="w-full max-w-xl">
          <label htmlFor="q" className="sr-only">
            Search the site
          </label>

          <div className="flex">
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              autoFocus
              placeholder={copy(
                'placeholder',
                'Speakers, sectors, articles, businesses…',
              )}
              className="min-h-12 w-full border border-white/30 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/45 focus:border-gold-400"
            />
            <button
              type="submit"
              className="inline-flex min-h-12 shrink-0 items-center gap-2 bg-gold-600 px-6 py-3 font-semibold uppercase tracking-wider text-white hover:bg-gold-700"
            >
              <Icon name="search" className="size-5" />
              <span className="sr-only sm:not-sr-only">Search</span>
            </button>
          </div>
        </form>
      </PageHero>

      <Section tone="white" size="wide">
        {query.length < 2 ? (
          <Container size="narrow" className="px-0">
            <p className="text-ink-600">
              {copy(
                'promptMessage',
                'Type at least two characters. Search covers articles, speakers, sectors and the business directory.',
              )}
            </p>
          </Container>
        ) : results.length === 0 ? (
          <EmptyState
            title={`Nothing found for “${query}”`}
            message={copy(
              'emptyMessage',
              "Try a shorter or more general term — a sector name, an organisation, or a speaker's surname.",
            )}
          >
            <Link href="/search" className="font-medium text-forest-700 hover:underline">
              Start again
            </Link>
          </EmptyState>
        ) : (
          <>
            <p
              role="status"
              className="text-sm font-medium text-ink-600"
            >
              {results.length} result{results.length === 1 ? '' : 's'} for “
              {query}”
            </p>

            <ul className="mt-8 divide-y divide-ink-200 border-y border-ink-200">
              {results.map((result) => (
                <li key={result.key}>
                  <Link
                    href={result.href}
                    className="group flex items-start justify-between gap-6 py-6"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                        {result.kind}
                      </p>
                      <h2 className="mt-1.5 font-display text-lg font-semibold text-ink-950 group-hover:text-forest-700">
                        {result.title}
                      </h2>
                      <p className="mt-1.5 max-w-2xl leading-relaxed text-ink-600">
                        {result.summary}
                      </p>
                    </div>
                    <Icon
                      name="arrowRight"
                      className="mt-1 size-5 shrink-0 text-forest-700"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>
    </>
  )
}

async function search(query: string): Promise<Result[]> {
  const needle = query.toLowerCase()
  const hit = (...fields: Array<string | null | undefined>) =>
    fields.some((field) => field?.toLowerCase().includes(needle))

  const [articles, speakers, sectors, listings] = await Promise.all([
    db.article.findMany({
      where: { status: 'PUBLISHED' },
      select: { id: true, slug: true, title: true, excerpt: true },
    }),
    db.speaker.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        slug: true,
        fullName: true,
        title: true,
        organisation: true,
      },
    }),
    db.sector.findMany({
      where: { isPublished: true },
      select: { id: true, slug: true, name: true, summary: true },
    }),
    db.directoryListing.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        slug: true,
        businessName: true,
        shortDescription: true,
      },
    }),
  ])

  return [
    ...speakers
      .filter((row) => hit(row.fullName, row.title, row.organisation))
      .map((row) => ({
        key: `speaker-${row.id}`,
        kind: 'Speaker',
        title: row.fullName,
        summary: `${row.title}, ${row.organisation}`,
        href: `/events/speakers/${row.slug}`,
      })),

    ...sectors
      .filter((row) => hit(row.name, row.summary))
      .map((row) => ({
        key: `sector-${row.id}`,
        kind: 'Sector',
        title: row.name,
        summary: truncate(row.summary, 180),
        href: `/learning-hub/sectors/${row.slug}`,
      })),

    ...articles
      .filter((row) => hit(row.title, row.excerpt))
      .map((row) => ({
        key: `article-${row.id}`,
        kind: 'Article',
        title: row.title,
        summary: truncate(row.excerpt, 180),
        href: `/blog/${row.slug}`,
      })),

    ...listings
      .filter((row) => hit(row.businessName, row.shortDescription))
      .map((row) => ({
        key: `listing-${row.id}`,
        kind: 'Business directory',
        title: row.businessName,
        summary: truncate(row.shortDescription, 180),
        href: `/directory/${row.slug}`,
      })),
  ]
}
