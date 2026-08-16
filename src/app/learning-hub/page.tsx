import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Card, LinkCard } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { truncate } from '@/lib/format'
import { getSectors } from '@/lib/settings'

/**
 * Learning Hub — the forum's reference material in one place.
 *
 * The reference site's Learning Hub is an on-demand video library. This forum
 * has no such library, and building a page shaped like one would leave an
 * empty shelf. What it does have is the material a visitor actually comes
 * looking for: the sector investment cases, the doing-business guide, the
 * published reports and the session recordings from previous editions. Those
 * fill the same slot in the navigation and answer the same question — "what
 * can I learn here without attending?"
 */

export const metadata: Metadata = {
  title: 'Learning Hub',
  description:
    'Sector investment cases, the doing-business guide, published reports and session recordings from the Freetown Business Forum.',
  alternates: { canonical: '/learning-hub' },
}

export default async function LearningHubPage() {
  const [sectors, collections, reports] = await Promise.all([
    getSectors(),
    db.mediaCollection.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { assets: true } } },
    }),
    db.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      select: { id: true, slug: true, title: true, excerpt: true },
    }),
  ])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Learning Hub', href: '/learning-hub' },
        ]}
      />

      <PageHero
        eyebrow="Learning Hub"
        title="Everything we know, "
        accent="on the record"
        lead="The investment case for each sector, a practical guide to trading here, the reports the forum publishes, and the sessions you missed."
      >
        <ButtonLink
          href="/learning-hub/sectors"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Browse sector guides
        </ButtonLink>
        <ButtonLink
          href="/learning-hub/doing-business"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Doing business guide
        </ButtonLink>
      </PageHero>

      {sectors.length > 0 && (
        <Section tone="white" size="wide">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="Sector guides"
              title="The investment case, sector by sector"
              lead="What the data says, which incentives apply, and who is already operating."
              className="mb-0"
            />
            <Link
              href="/learning-hub/sectors"
              className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
            >
              All sectors
              <Icon name="arrowRight" className="size-4" />
            </Link>
          </div>

          <CardGrid columns={4} className="mt-10">
            {sectors.map((sector) => (
              <LinkCard
                key={sector.id}
                href={`/learning-hub/sectors/${sector.slug}`}
              >
                <span className="flex size-11 items-center justify-center bg-harbour-50 text-harbour-700">
                  <Icon name={sector.iconKey} className="size-5" />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-ink-950 group-hover:text-forest-700">
                  {sector.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {truncate(sector.summary, 120)}
                </p>
              </LinkCard>
            ))}
          </CardGrid>
        </Section>
      )}

      <Section tone="muted" size="wide">
        <SectionHeading
          eyebrow="Libraries"
          title="Recordings, photography and downloads"
          lead="Everything the forum has published, grouped by what it is."
        />

        <CardGrid columns={3} className="mt-10">
          {collections.map((collection) => (
            <LinkCard
              key={collection.id}
              href={`/learning-hub/${collection.slug === 'downloads' ? 'downloads' : 'recordings'}`}
              className="h-full"
            >
              <span className="flex size-11 items-center justify-center bg-forest-100 text-forest-700">
                <Icon
                  name={
                    collection.kind === 'DOWNLOAD'
                      ? 'download'
                      : collection.kind === 'VIDEO'
                        ? 'zap'
                        : 'document'
                  }
                  className="size-5"
                />
              </span>

              <h3 className="mt-4 font-display text-base font-semibold text-ink-950 group-hover:text-forest-700">
                {collection.name}
              </h3>

              {collection.description && (
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {collection.description}
                </p>
              )}

              {/* The honest count, including nought. A library that says
                  nothing about its size reads as fuller than it is. */}
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-500">
                {collection._count.assets === 0
                  ? 'Being catalogued'
                  : `${collection._count.assets} item${collection._count.assets === 1 ? '' : 's'}`}
              </p>
            </LinkCard>
          ))}

          <Card className="flex h-full flex-col bg-harbour-800 text-white">
            <span className="flex size-11 items-center justify-center bg-white/15">
              <Icon name="document" className="size-5" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold">
              Doing business in Sierra Leone
            </h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-white/75">
              Registration, tax, incentives, land tenure and labour — the
              practical guide for investors arriving for the first time.
            </p>
            <ButtonLink
              href="/learning-hub/doing-business"
              size="sm"
              className="mt-5 self-start rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
            >
              Read the guide
            </ButtonLink>
          </Card>
        </CardGrid>
      </Section>

      {reports.length > 0 && (
        <Section tone="white" size="wide">
          <SectionHeading
            eyebrow="Latest analysis"
            title="Recently published"
          />

          <ul className="mt-10 divide-y divide-ink-200 border-y border-ink-200">
            {reports.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/blog/${report.slug}`}
                  className="group flex items-start justify-between gap-6 py-6"
                >
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink-950 group-hover:text-forest-700">
                      {report.title}
                    </h3>
                    <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">
                      {truncate(report.excerpt, 180)}
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
        </Section>
      )}

      <CtaBand
        title="Members get more of this"
        lead="Full sector datasets, the Deal Room, and session recordings released to members first."
      >
        <ButtonLink
          href="/membership"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Join FBF
        </ButtonLink>
      </CtaBand>
    </>
  )
}
