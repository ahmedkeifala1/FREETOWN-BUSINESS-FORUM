import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CtaBand,
  EmptyState,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { MediaKind } from '@/lib/enums'
import { fileKindLabel, formatBytes, formatDate } from '@/lib/format'
import { getCurrentEvent } from '@/lib/settings'

/**
 * Reports & downloads (SDR §4.14 "a downloads library (reports, brochures)").
 *
 * A list, not a card grid. Every row here is a file someone is deciding
 * whether to spend data on, and the three things that decide it — what it is,
 * what format, how big — read faster in a row than scattered across a card
 * (NFR-01: this audience is on metered mobile data).
 *
 * The event brochure and sponsorship prospectus are pinned above the library
 * because they are what most visitors arriving here are after, and they live
 * on the event row rather than in a media collection.
 */

export const metadata: Metadata = {
  title: 'Reports & downloads',
  description:
    'Reports, brochures and published material from the Freetown Business Forum.',
  alternates: { canonical: '/learning-hub/downloads' },
}

export default async function DownloadsPage() {
  const [collections, event] = await Promise.all([
    db.mediaCollection.findMany({
      where: { isPublished: true, kind: MediaKind.DOWNLOAD },
      orderBy: { sortOrder: 'asc' },
      include: {
        assets: {
          where: { isPublic: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        },
      },
    }),
    getCurrentEvent(),
  ])

  const pinned = [
    event?.brochureUrl && {
      href: event.brochureUrl,
      title: `${event.name} — event brochure`,
      description:
        'The programme, the theme, who attends and what registration includes.',
    },
    event?.prospectusUrl && {
      href: event.prospectusUrl,
      title: `${event.name} — sponsorship prospectus`,
      description:
        'Packages, tiers, what each includes and the terms that govern them.',
    },
  ].filter(
    (item): item is { href: string; title: string; description: string } =>
      Boolean(item),
  )

  const withAssets = collections.filter(
    (collection) => collection.assets.length > 0,
  )

  const isEmpty = pinned.length === 0 && withAssets.length === 0

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Learning Hub', href: '/learning-hub' },
          { label: 'Reports & downloads', href: '/learning-hub/downloads' },
        ]}
      />

      <PageHero
        eyebrow="Learning Hub"
        title="Reports &"
        accent="downloads"
        lead="Everything the forum publishes in a form you can keep — reports, brochures, prospectuses and the material behind the sessions."
      />

      {isEmpty ? (
        <Section tone="white">
          <EmptyState
            title="Nothing published yet"
            message="Reports and brochures are added here as they are released. The secretariat can send you anything that exists but has not been published."
          >
            <ButtonLink href="/contact" variant="primary">
              Ask the secretariat
            </ButtonLink>
          </EmptyState>
        </Section>
      ) : (
        <>
          {pinned.length > 0 && (
            <Section tone="white" size="wide">
              <SectionHeading eyebrow="Start here" title="This year’s forum" />

              <ul className="mt-8 divide-y divide-ink-200 border-y border-ink-200">
                {pinned.map((item) => (
                  <li key={item.href}>
                    <DownloadRow
                      href={item.href}
                      title={item.title}
                      description={item.description}
                    />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {withAssets.map((collection, index) => (
            <Section
              key={collection.id}
              tone={index % 2 === 0 ? 'muted' : 'white'}
              size="wide"
            >
              <SectionHeading
                title={collection.name}
                lead={collection.description ?? undefined}
              />

              <ul className="mt-8 divide-y divide-ink-200 border-y border-ink-200">
                {collection.assets.map((asset) => (
                  <li key={asset.id}>
                    <DownloadRow
                      href={asset.url}
                      title={asset.title ?? asset.filename}
                      description={asset.caption ?? undefined}
                      meta={[
                        fileKindLabel(asset.mimeType),
                        formatBytes(asset.sizeBytes),
                        `Added ${formatDate(asset.createdAt)}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ))}
        </>
      )}

      <CtaBand
        title="Looking for something that is not here?"
        lead="Past programmes, delegate statistics, session notes — the secretariat holds a great deal that has never been published. Ask."
        tone="harbour"
      >
        <ButtonLink href="/contact" variant="accent" size="lg">
          Request a document
        </ButtonLink>
      </CtaBand>
    </>
  )
}

/**
 * One download.
 *
 * A plain <a>, not a Next <Link>: these are files, not routes, and the router
 * should not try to prefetch a 4MB PDF. `download` is deliberately absent —
 * some of these are worth reading in the browser's own viewer, and forcing a
 * save on a handset with little storage is a decision for the reader.
 */
function DownloadRow({
  href,
  title,
  description,
  meta,
}: {
  href: string
  title: string
  description?: string
  meta?: string
}) {
  return (
    <a
      href={href}
      className="group flex items-start gap-4 py-5 transition-colors hover:bg-white/60"
    >
      <Icon
        name="document"
        className="mt-0.5 size-6 shrink-0 text-forest-600"
      />

      <div className="min-w-0 flex-1">
        <p className="font-display font-semibold text-ink-950 group-hover:text-forest-700">
          {title}
        </p>

        {description && (
          <p className="mt-1 text-sm leading-relaxed text-ink-600">
            {description}
          </p>
        )}

        {meta && <p className="mt-1.5 text-xs text-ink-500">{meta}</p>}
      </div>

      <Icon
        name="download"
        className="mt-0.5 size-5 shrink-0 text-ink-400 group-hover:text-forest-700"
      />
      <span className="sr-only">Download</span>
    </a>
  )
}
