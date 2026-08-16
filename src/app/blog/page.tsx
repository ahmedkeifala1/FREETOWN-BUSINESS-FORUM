import Link from 'next/link'
import type { Metadata } from 'next'

import { Badge, LinkCard } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  EmptyState,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { formatDateShort, truncate } from '@/lib/format'

/**
 * Blog — news, insight and press (§4.13).
 *
 * The newest article leads at full width and the rest follow in a grid: on a
 * publication with a handful of posts a uniform grid gives no signal about
 * what is worth reading first, and the editor's ordering is the only signal
 * available.
 *
 * Category filtering is a set of links rather than a control, so each filtered
 * view has its own URL that can be shared and indexed (NFR-10).
 */

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'News, insight and analysis from the Freetown Business Forum — investment, policy and member stories.',
  alternates: { canonical: '/blog' },
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams

  const [categories, articles] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.article.findMany({
      where: {
        status: 'PUBLISHED',
        ...(category ? { category: { slug: category } } : {}),
      },
      orderBy: { publishedAt: 'desc' },
      include: { category: { select: { name: true, slug: true } } },
    }),
  ])

  const [lead, ...rest] = articles
  const activeCategory = categories.find((row) => row.slug === category)

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Blog', href: '/blog' },
        ]}
      />

      <PageHero
        eyebrow="Blog"
        title="What is moving"
        accent="the economy"
        lead="Deals, policy changes and the businesses behind them — written by the secretariat and by members."
      />

      <Section tone="white" size="wide">
        <nav aria-label="Filter by category">
          <ul className="flex flex-wrap gap-2">
            <li>
              <FilterLink href="/blog" active={!category}>
                All
              </FilterLink>
            </li>
            {categories.map((row) => (
              <li key={row.id}>
                <FilterLink
                  href={`/blog?category=${row.slug}`}
                  active={category === row.slug}
                >
                  {row.name}
                </FilterLink>
              </li>
            ))}
          </ul>
        </nav>

        {articles.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            message={
              activeCategory
                ? `No articles have been published under ${activeCategory.name}.`
                : 'The first articles are being written.'
            }
          >
            <Link
              href="/blog"
              className="font-medium text-forest-700 hover:underline"
            >
              See all articles
            </Link>
          </EmptyState>
        ) : (
          <>
            {lead && (
              <Link
                href={`/blog/${lead.slug}`}
                className="group mt-10 block border-t-2 border-ink-950 pt-8"
              >
                <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
                  {lead.heroImageUrl && (
                    // Remote CMS URL — see the note in ui/card.tsx.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={lead.heroImageUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-64 w-full object-cover lg:h-full"
                    />
                  )}

                  <div className={lead.heroImageUrl ? '' : 'lg:col-span-2'}>
                    <div className="flex flex-wrap items-center gap-2">
                      {lead.category && (
                        <Badge tone="forest">{lead.category.name}</Badge>
                      )}
                      {lead.publishedAt && (
                        <time
                          dateTime={lead.publishedAt.toISOString()}
                          className="text-xs text-ink-500"
                        >
                          {formatDateShort(lead.publishedAt)}
                        </time>
                      )}
                    </div>

                    <h2 className="mt-4 font-display text-2xl font-bold leading-tight text-ink-950 group-hover:text-forest-700 sm:text-3xl">
                      {lead.title}
                    </h2>

                    <p className="mt-4 text-lg leading-relaxed text-ink-700">
                      {truncate(lead.excerpt, 260)}
                    </p>

                    <span className="mt-6 inline-flex items-center gap-1.5 font-medium text-forest-700">
                      Read the article
                      <Icon name="arrowRight" className="size-4" />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <CardGrid columns={3} className="mt-14">
                {rest.map((article) => (
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
                        className="h-44 w-full object-cover"
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
            )}
          </>
        )}
      </Section>
    </>
  )
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'inline-flex min-h-11 items-center bg-forest-700 px-5 py-2.5 text-sm font-semibold text-white'
          : 'inline-flex min-h-11 items-center border border-ink-300 px-5 py-2.5 text-sm font-medium text-ink-700 hover:border-forest-600 hover:text-forest-700'
      }
    >
      {children}
    </Link>
  )
}
