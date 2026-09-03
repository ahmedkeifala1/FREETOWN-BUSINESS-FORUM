import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { LinkCard } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  EmptyState,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { getPageCopy } from '@/lib/settings'
import { truncate } from '@/lib/format'

/**
 * Sector guides (SDR §4.12 "sector pages — overview, data, incentives and
 * relevant opportunities").
 *
 * The index. Each card carries the sector's icon, its one-line case and how
 * much material sits behind it, so a visitor can tell an established sector
 * page from a stub before clicking — a grid of eight identical cards where
 * three are empty wastes more of their time than an honest count does.
 */

export const metadata: Metadata = {
  title: 'Sector guides',
  description:
    'Investment cases for Sierra Leone’s key sectors — agriculture, mining, energy, tourism, fintech, infrastructure, fisheries and manufacturing.',
  alternates: { canonical: '/learning-hub/sectors' },
}

export default async function SectorsPage() {
  const [sectors, copy] = await Promise.all([
    db.sector.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            opportunities: { where: { isPublished: true } },
            listings: { where: { isPublished: true } },
          },
        },
      },
    }),
    getPageCopy('learning-hub'),
  ])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Learning Hub', href: '/learning-hub' },
          { label: 'Sector guides', href: '/learning-hub/sectors' },
        ]}
      />

      <PageHero
        eyebrow={copy('sectorsEyebrow', 'Learning Hub')}
        title={copy('sectorsHeroTitle', 'Sector')}
        accent={copy('sectorsHeroAccent', 'guides')}
        lead={copy(
          'sectorsHeroLead',
          "Where Sierra Leone's opportunity actually sits, sector by sector — what is there, what the incentives are, and which businesses and propositions are already in the room.",
        )}
      />

      <Section tone="white" size="wide">
        {sectors.length === 0 ? (
          <EmptyState
            title={copy('sectorsEmptyTitle', 'Sector guides are being written')}
            message={copy(
              'sectorsEmptyMessage',
              'They will be published here as they are completed.',
            )}
          />
        ) : (
          <CardGrid columns={3}>
            {sectors.map((sector) => (
              <LinkCard
                key={sector.id}
                href={`/learning-hub/sectors/${sector.slug}`}
                className="h-full"
              >
                <Icon name={sector.iconKey} className="size-9 text-forest-600" />

                <h2 className="mt-4 font-display text-lg font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                  {sector.name}
                </h2>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {truncate(sector.summary, 150)}
                </p>

                <p className="mt-4 border-t border-ink-100 pt-4 text-sm text-ink-500">
                  {sector._count.listings} member
                  {sector._count.listings === 1 ? '' : 's'}
                  <span className="mx-1.5 text-ink-300">·</span>
                  {sector._count.opportunities} proposition
                  {sector._count.opportunities === 1 ? '' : 's'}
                </p>

                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                  Read the guide
                  <Icon name="arrowRight" className="size-4" />
                </span>
              </LinkCard>
            ))}
          </CardGrid>
        )}
      </Section>

      <CtaBand
        title={copy('sectorsCtaTitle', 'The wider picture')}
        lead={copy(
          'sectorsCtaLead',
          'The doing-business guide covers what applies whichever sector you are in — registration, tax, land, labour and the incentives on offer.',
        )}
        tone="harbour"
      >
        <ButtonLink
          href="/learning-hub/doing-business"
          variant="accent"
          size="lg"
        >
          Doing business in Sierra Leone
        </ButtonLink>
      </CtaBand>
    </>
  )
}
