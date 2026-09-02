import Link from 'next/link'
import type { Metadata } from 'next'

import { HeroMosaic, type MosaicTile } from '@/components/site/hero-mosaic'
import { SpeakerWall } from '@/components/site/speaker-wall'
import { ButtonLink } from '@/components/ui/button'
import { Card, LinkCard } from '@/components/ui/card'
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
import { MediaKind } from '@/lib/enums'
import { pluralise, truncate } from '@/lib/format'
import { getSectors } from '@/lib/settings'

/**
 * Learning Hub — laid out like the reference site's
 * (londonbusinessforum.com/learning-hub), at the secretariat's request.
 *
 * The reference page runs: a headline made of its own numbers, an explainer
 * about the memberships that unlock the library, a section on what is inside
 * it and which topics it covers, then a wall of the speakers whose sessions
 * fill it. That order is kept here, because it is an argument rather than an
 * index — it says how much material there is, who it is for and who is in it,
 * before it asks anyone to browse.
 *
 * Two departures, both because the forum's material is not the reference's:
 *
 *  - the reference gates everything behind a login and can therefore show
 *    screenshots of its player. Ours is open, so the "what's inside" band
 *    shows the real libraries and the sector guides instead — which are also
 *    the only route to those pages now that the header carries no Learning
 *    Hub menu;
 *  - the counters are read from the database, and a clause is dropped rather
 *    than printed as a nought. A library advertising "0 recordings" argues
 *    against itself, and this one is still being catalogued.
 */

export const metadata: Metadata = {
  title: 'Learning Hub',
  description:
    'Session recordings, published reports, the doing-business guide and the sector investment cases from the Freetown Business Forum.',
  alternates: { canonical: '/learning-hub' },
}

export default async function LearningHubPage() {
  const [
    sectors,
    collections,
    recordingCount,
    downloadCount,
    speakerCount,
    speakers,
    videoThumbnails,
    galleryPhotos,
  ] = await Promise.all([
    getSectors(),
    db.mediaCollection.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { assets: true } } },
    }),
    db.mediaAsset.count({ where: { isPublic: true, kind: MediaKind.VIDEO } }),
    db.mediaAsset.count({
      where: { isPublic: true, kind: MediaKind.DOWNLOAD },
    }),
    db.speaker.count({ where: { isPublished: true } }),
    db.speaker.findMany({
      where: { isPublished: true },
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { fullName: 'asc' },
      ],
      take: 12,
      select: {
        id: true,
        slug: true,
        fullName: true,
        title: true,
        organisation: true,
        photoUrl: true,
      },
    }),
    // The wall the reference site fills with player thumbnails. Ours takes
    // the poster frames off the recordings first, because those are the
    // library the headline is counting.
    db.mediaAsset.findMany({
      where: {
        isPublic: true,
        kind: MediaKind.VIDEO,
        thumbnailUrl: { not: null },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 12,
      select: { id: true, thumbnailUrl: true },
    }),
    // …and falls back to the forum's own photographs, which is what the
    // homepage hero uses. A half-empty wall is worse than a borrowed one.
    db.mediaAsset.findMany({
      where: {
        isPublic: true,
        kind: MediaKind.GALLERY,
        collection: { slug: 'forum-gallery', isPublished: true },
      },
      orderBy: { sortOrder: 'asc' },
      take: 12,
      select: { id: true, url: true },
    }),
  ])

  const tiles: MosaicTile[] = [
    ...videoThumbnails.map((asset) => ({
      kind: 'photo' as const,
      id: asset.id,
      url: asset.thumbnailUrl as string,
    })),
    ...galleryPhotos.map((photo) => ({
      kind: 'photo' as const,
      id: photo.id,
      url: photo.url,
    })),
  ].slice(0, 12)

  const holdings: Figure[] = [
    recordingCount > 0 && {
      count: recordingCount,
      noun: `session ${pluralise(recordingCount, 'recording')}`,
    },
    downloadCount > 0 && {
      count: downloadCount,
      noun: `published ${pluralise(downloadCount, 'report')}`,
    },
    sectors.length > 0 && {
      count: sectors.length,
      noun: `sector ${pluralise(sectors.length, 'guide')}`,
    },
  ].filter((figure): figure is Figure => Boolean(figure))

  const topics = sectors.map((sector) => sector.name)

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Learning Hub', href: '/learning-hub' },
        ]}
      />

      <LearningHubHero
        holdings={holdings}
        speakerCount={speakerCount}
        tiles={tiles}
      />

      {/* ── 1. About our memberships ─────────────────────────────────────── */}

      <Section tone="white" size="wide">
        <div className="max-w-3xl">
          <SectionHeading
            eyebrow="Membership"
            title="About our memberships"
            className="mb-0"
          />

          <p className="mt-6 text-base leading-relaxed text-ink-700 sm:text-lg">
            Membership gives your company access to the forum&rsquo;s whole
            programme — the bi-annual events, the Deal Room, a listing in the
            national business directory, and the Learning Hub in full. Whether
            it is your leadership team weighing an expansion or your younger
            managers learning how capital is actually raised here, the material
            is what the room itself works from.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <MembershipActions />
          </div>
        </div>
      </Section>

      {/* ── 2. What is inside the hub ────────────────────────────────────── */}

      <Section tone="muted" size="wide">
        <SectionHeading
          eyebrow="What’s inside"
          title="The Learning Hub, library by library"
          lead={
            topics.length > 0
              ? `Recordings, reports and guides across the sectors the forum works on: ${sentence(topics)}.`
              : 'Recordings, reports and guides across the sectors the forum works on.'
          }
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

        {/* The reference repeats its three membership controls under this
            section rather than making the reader scroll back for them. */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <MembershipActions />
        </div>
      </Section>

      {/* ── 3. The sector guides ─────────────────────────────────────────── */}

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

      {/* ── 4. Meet the speakers ─────────────────────────────────────────── */}

      <SpeakerWall
        speakers={speakers}
        eyebrow="Speakers"
        title="Meet the speakers"
        lead="The ministers, investors, founders and development partners whose sessions fill the hub."
        linkLabel="View all speakers"
        tone="muted"
      />

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

/** One counted holding: "12 session recordings". */
type Figure = { count: number; noun: string }

/**
 * The hues the figures cycle through, in the reference's own order — its
 * headline runs orange, then blue, then gold. `ember` and `plum` are the
 * reference's colours and live nowhere else on the site but the homepage
 * hero (see `globals.css`); each is used at display size only, which is the
 * condition on their contrast.
 */
const FIGURE_TONES = ['text-ember-500', 'text-harbour-400', 'text-plum-400']

/**
 * The hero, built to the reference page's composition: the lamp, the eyebrow,
 * a headline that is mostly numbers, and a wall of thumbnails filling the
 * right half and running off its edges.
 *
 * The numbers are the argument — how much material there is — so they are lit
 * and the words around them are not. They are also counted from the database
 * rather than written into the copy: a headline claiming a library the
 * secretariat has not uploaded yet is the one thing a page like this cannot
 * survive. A holding at nought drops out of the sentence entirely, and if
 * nothing at all is published the headline falls back to a plain claim.
 *
 * The panel is absolutely positioned on `lg` so it reaches the right edge of
 * the viewport without `100vw` arithmetic, which overflows by the width of the
 * scrollbar on Windows — the same construction as the homepage hero. Below
 * `lg` it returns to normal flow and stacks under the call to action.
 */
function LearningHubHero({
  holdings,
  speakerCount,
  tiles,
}: {
  holdings: Figure[]
  speakerCount: number
  tiles: MosaicTile[]
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink-950 text-white">
      <Container size="wide">
        <div className="py-14 sm:py-20 lg:w-[54%] lg:py-28 lg:pr-10">
          <Icon
            name="lightbulb"
            strokeWidth={1.5}
            className="size-14 text-gold-400 sm:size-16"
          />

          <p className="mt-7 font-display text-lg font-semibold uppercase tracking-[0.2em] text-white/85 sm:text-xl">
            Learning Hub
          </p>

          <h1 className="mt-6 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
            {holdings.length === 0 ? (
              'Everything the forum publishes, free to everyone.'
            ) : (
              <>
                {holdings.map((figure, index) => (
                  <span key={figure.noun}>
                    {index > 0 &&
                      (index === holdings.length - 1 ? ' and ' : ', ')}
                    <span className={FIGURE_TONES[index % FIGURE_TONES.length]}>
                      {figure.count}
                    </span>{' '}
                    {figure.noun}
                  </span>
                ))}
                {speakerCount > 0 && (
                  <>
                    {' from '}
                    <span className="text-gold-400">{speakerCount}</span>{' '}
                    world-class {pluralise(speakerCount, 'speaker')}
                  </>
                )}
                .
              </>
            )}
          </h1>

          <p className="mt-8 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            What was actually said on the platform, the reports behind it, and
            the investment case for every sector the forum works on. Free to
            read and watch; members get the underlying datasets, the Deal Room
            and new recordings first.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink
              href="/membership"
              variant="accent"
              size="lg"
              className="rounded-none font-semibold uppercase tracking-wider"
            >
              Find out more
              <Icon name="arrowRight" className="size-5" />
            </ButtonLink>
            <ButtonLink
              href="/portal"
              size="lg"
              className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10 active:bg-white/15"
            >
              Login
            </ButtonLink>
          </div>
        </div>
      </Container>

      <div className="relative min-h-104 bg-ink-900 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%] lg:min-h-0">
        <HeroMosaic tiles={tiles} />
      </div>
    </section>
  )
}

/**
 * The three membership controls, repeated under each explainer as they are on
 * the reference site. Defined once so the two rows cannot drift apart.
 */
function MembershipActions() {
  return (
    <>
      <ButtonLink href="/contact" variant="primary" size="md">
        Make an enquiry
      </ButtonLink>
      <ButtonLink href="/membership/tiers" variant="outline" size="md">
        See the tiers
      </ButtonLink>
      <ButtonLink href="/membership" variant="ghost" size="md">
        Find out more about membership
        <Icon name="arrowRight" className="size-4" />
      </ButtonLink>
    </>
  )
}

/** "a, b and c" — the counters read as a sentence, not as a list. */
function sentence(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
