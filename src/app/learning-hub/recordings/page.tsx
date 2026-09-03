import type { Metadata } from 'next'

import { VideoFeature } from '@/components/site/video-feature'
import { ButtonLink } from '@/components/ui/button'
import {
  Breadcrumbs,
  CardGrid,
  CtaBand,
  EmptyState,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { getPageCopy } from '@/lib/settings'
import { MediaKind } from '@/lib/enums'
import { truncate } from '@/lib/format'

/**
 * Session recordings (§4.14 "video highlights").
 *
 * Recordings held elsewhere are thumbnails linking out to their host, rather
 * than embedded players. Eight embedded iframes would pull several megabytes
 * of third-party script onto a page most visitors are only scanning (NFR-01),
 * and the host's own player is where the captions, the quality selector and
 * the resume position already work.
 *
 * The forum's own footage is the exception: a file this site serves has no
 * host to link to, so it is played in place. The two are told apart by the
 * URL — `/`-relative is ours. Neither kind fetches anything until it is asked
 * to, so the page costs the same to scan either way.
 */

export const metadata: Metadata = {
  title: 'Session recordings',
  description:
    'Watch sessions from previous editions of the Freetown Business Forum — panels, keynotes and roundtables.',
  alternates: { canonical: '/learning-hub/recordings' },
}

export default async function RecordingsPage() {
  const [collections, copy] = await Promise.all([
    db.mediaCollection.findMany({
      where: { isPublished: true, kind: MediaKind.VIDEO },
      orderBy: { sortOrder: 'asc' },
      include: {
        assets: {
          where: { isPublic: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        },
      },
    }),
    getPageCopy('learning-hub'),
  ])

  const withAssets = collections.filter(
    (collection) => collection.assets.length > 0,
  )

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Learning Hub', href: '/learning-hub' },
          { label: 'Session recordings', href: '/learning-hub/recordings' },
        ]}
      />

      <PageHero
        eyebrow={copy('recordingsEyebrow', 'Learning Hub')}
        title={copy('recordingsHeroTitle', 'Session')}
        accent={copy('recordingsHeroAccent', 'recordings')}
        lead={copy(
          'recordingsHeroLead',
          'What was actually said on the platform — keynotes, panels and roundtables from previous editions, free to watch.',
        )}
      />

      {withAssets.length === 0 ? (
        <Section tone="white">
          <EmptyState
            title={copy('recordingsEmptyTitle', 'Recordings are being prepared')}
            message={copy(
              'recordingsEmptyMessage',
              'Sessions from the last edition are being edited and captioned. They will appear here as they are released.',
            )}
          >
            <ButtonLink href="/events/agenda" variant="primary">
              See this year’s programme
            </ButtonLink>
          </EmptyState>
        </Section>
      ) : (
        withAssets.map((collection, index) => (
          <Section
            key={collection.id}
            tone={index % 2 === 0 ? 'white' : 'muted'}
            size="wide"
          >
            <SectionHeading
              title={collection.name}
              lead={collection.description ?? undefined}
            />

            <CardGrid columns={3} className="mt-10">
              {collection.assets.map((asset) =>
                // A `/`-relative URL is a file this site serves itself, so it
                // is played here; anything else lives on a platform whose own
                // player is the better place to watch it — see the note above.
                asset.url.startsWith('/') ? (
                  <div key={asset.id} className="flex flex-col">
                    <div className="aspect-video w-full overflow-hidden bg-ink-950">
                      {/*
                        `object-contain`, not cover. The forum's own footage is
                        filmed portrait on a phone, and cropping it to a
                        landscape thumbnail takes the heads off. In this grid
                        the uniform box is what matters — the homepage band is
                        where the clip is given its proper shape.
                      */}
                      <VideoFeature
                        src={asset.url}
                        poster={asset.thumbnailUrl}
                        label={asset.altText ?? asset.title ?? asset.filename}
                        autoplay={false}
                        className="size-full object-contain"
                      />
                    </div>

                    <h3 className="mt-4 font-display text-base font-semibold leading-snug text-ink-950">
                      {asset.title ?? asset.filename}
                    </h3>

                    {asset.caption && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-600">
                        {truncate(asset.caption, 140)}
                      </p>
                    )}
                  </div>
                ) : (
                  <a
                    key={asset.id}
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="group flex flex-col"
                  >
                    <Thumbnail
                      thumbnailUrl={asset.thumbnailUrl}
                      altText={asset.altText}
                    />

                    <h3 className="mt-4 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                      {asset.title ?? asset.filename}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </h3>

                    {asset.caption && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-600">
                        {truncate(asset.caption, 140)}
                      </p>
                    )}
                  </a>
                ),
              )}
            </CardGrid>
          </Section>
        ))
      )}

      <CtaBand
        title={copy('recordingsCtaTitle', 'Recordings are not the room')}
        lead={copy(
          'recordingsCtaLead',
          'The deals get done in the corridors between the sessions. That part is not filmed.',
        )}
      >
        <ButtonLink
          href="/register"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Register to attend
        </ButtonLink>
        <ButtonLink
          href="/learning-hub/downloads"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Reports & downloads
        </ButtonLink>
      </CtaBand>
    </>
  )
}

/**
 * The video thumbnail.
 *
 * A fixed 16:9 box with a play badge, so a collection of recordings from
 * different hosts still reads as one grid. The badge is decorative — the link
 * is already announced as a link and the heading names the session, so a
 * second "play video" in the accessibility tree would just be noise.
 */
function Thumbnail({
  thumbnailUrl,
  altText,
}: {
  thumbnailUrl: string | null
  altText: string | null
}) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-ink-950">
      {thumbnailUrl ? (
        // Remote CMS URL — see the note in ui/card.tsx.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt={altText ?? ''}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition group-hover:scale-105"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-full items-center justify-center font-display text-3xl font-bold text-white/15"
        >
          FBF
        </span>
      )}

      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:bg-white">
          {/* A play triangle, drawn rather than pulled from the icon set —
              it is the one glyph the line-icon style cannot render. */}
          <svg viewBox="0 0 24 24" className="ml-1 size-6 fill-forest-700">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </div>
  )
}
