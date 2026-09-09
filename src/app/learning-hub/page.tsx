import Link from 'next/link'
import type { Metadata } from 'next'

import { HeroMosaic, type MosaicTile } from '@/components/site/hero-mosaic'
import { SpeakerWall } from '@/components/site/speaker-wall'
import { ButtonLink } from '@/components/ui/button'
import { LinkCard } from '@/components/ui/card'
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
import { paragraphs, parseJsonColumn, pluralise, truncate } from '@/lib/format'
import { getPageBlocks, getPageCopy, getSectors } from '@/lib/settings'

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

/**
 * The training programmes the forum has proposed but not yet run.
 *
 * A repeating block, so the secretariat adds a third without a deploy — the
 * `trainings` block overrides this list entirely when it has one. This is the
 * fallback, which is why the two the forum has proposed are written here
 * rather than seeded: an unwritten block leaves the band reading as it does
 * today rather than emptying it (see `getPageCopy` in lib/settings).
 *
 * Each is a *proposal*. None has dates, a cohort or an application form, so
 * none is an event or a bookable course — the band says what the forum intends
 * to run and asks the reader to get in touch, and nothing on it implies a
 * place can be reserved.
 */
type ProposedTraining = { title: string; body: string }

const PROPOSED_TRAINING: ProposedTraining[] = [
  {
    title: 'Youth and Women Entrepreneurship Incubator Programme',
    body: [
      'Sierra Leone’s rapidly growing youth population, roughly 60% under age 35, presents both a challenge and an opportunity. Many young people lack formal employment prospects, and women face additional barriers in business. The Freetown Business Forum proposes a 6-month incubator programme with the aim of empowering 300 young entrepreneurs (180 women, 120 men) with training, mentorship, and seed funding to launch agribusiness and tech ventures. Participants will develop business plans in agro-tech and digital fields, refine their ideas through expert coaching, and pitch for seed grants to start their enterprises. The project aligns with national goals of trade, industry and human capital development, and will drive inclusive growth by creating new jobs and sustainable startups.',
      'High youth unemployment and underemployment are fueling poverty and social strain. Many young Sierra Leoneans lack the business skills, mentorship, and startup capital needed to create successful ventures. Women entrepreneurs face even greater obstacles: despite their active participation, they often remain at subsistence-level enterprises due to limited access to finance, business training and networks. Existing incubation and support services are scarce and fragmented. This gap means innovative agribusiness and tech ideas go unfunded and untested, and the potential to transform traditional agriculture or digital opportunities is lost. Without intervention, the status quo will perpetuate economic inequality and brain drain. Our incubator aims to address these problems by equipping youth and women with the tools, funding and support to start viable businesses in strategic sectors.',
    ].join('\n\n'),
  },
  {
    title: 'Rural Business Empowerment Programme',
    body: 'Sierra Leone’s economy is predominantly agrarian: agriculture accounts for over half of GDP, and rural women and youth make up the backbone of the sector. In fact, studies report that rural women comprise roughly 70% of the country’s agricultural labour force. Yet decades of underinvestment, poor infrastructure and persistent gender biases mean that productivity and incomes remain very low. The Freetown Business Forum proposes a one-year Rural Business Empowerment Programme in Bo, Port Loko and Kono districts to tackle these challenges. This project will directly empower 300 rural women and young farmers with practical training, improved access to credit, and agricultural equipment. Its goals are to raise farm productivity, increase household incomes, and create sustainable agribusinesses. The programme aligns with national priorities: Sierra Leone’s Feed Salone strategy explicitly names “Empowering Women and Youth” as a core pillar and supports government targets for job creation. By partnering with international donors focused on agriculture and gender empowerment, the FBF will leverage proven approaches — small grants and cooperative training among them — to achieve measurable impacts in food security and livelihood improvement.',
  },
]

export const metadata: Metadata = {
  title: 'Learning Hub',
  description:
    'Session recordings, published reports, the doing-business guide and the sector investment cases from the Freetown Business Forum.',
  alternates: { canonical: '/learning-hub' },
}

export default async function LearningHubPage() {
  const [
    sectors,
    recordingCount,
    downloadCount,
    speakerCount,
    speakers,
    videoThumbnails,
    galleryPhotos,
    copy,
    blocks,
  ] = await Promise.all([
    getSectors(),
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
    getPageCopy('learning-hub'),
    getPageBlocks('learning-hub'),
  ])

  // `getPageBlocks` is what `getPageCopy` reads underneath and both are cached,
  // so asking for the raw blocks as well costs no second query. The prose
  // blocks go through `copy`; this one is a list and has to be parsed.
  const trainings = parseJsonColumn<ProposedTraining[]>(
    blocks.trainings ?? null,
    PROPOSED_TRAINING,
  )

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

      {/* ── 1. Proposed training ─────────────────────────────────────────── */}

      {trainings.length > 0 && (
        <Section tone="forest" size="wide">
          <SectionHeading
            eyebrow={copy('trainingEyebrow', 'In development')}
            title={copy('trainingTitle', 'Proposed training')}
            lead={copy(
              'trainingLead',
              'Programmes the forum intends to run. None is open for applications yet — the secretariat is assembling the funding and the partners, and will announce each one here.',
            )}
            inverted
          />

          <div className="mt-12 space-y-12 lg:space-y-16">
            {trainings.map((training, index) => (
              <article
                key={training.title}
                className="grid gap-6 border-t border-white/15 pt-8 lg:grid-cols-12 lg:gap-14"
              >
                <div className="lg:col-span-5">
                  {/* Numbered because they are a set the reader works through,
                      and because "Proposed training 1" was how they arrived. */}
                  <p className="font-display text-5xl font-extrabold leading-none text-gold-400">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-5 font-display text-xl font-semibold leading-snug text-white sm:text-2xl">
                    {training.title}
                  </h3>
                </div>

                <div className="space-y-4 leading-relaxed text-white/75 lg:col-span-7">
                  {paragraphs(training.body).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
      )}

      {/* ── 2. The sector guides ─────────────────────────────────────────── */}

      {sectors.length > 0 && (
        <Section tone="white" size="wide">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow={copy('sectorsEyebrow', 'Sector guides')}
              title={copy('sectorsTitle', 'The investment case, sector by sector')}
              lead={copy(
                'sectorsLead',
                'What the data says, which incentives apply, and who is already operating.',
              )}
              className="mb-0"
            />
            <Link
              href="/learning-hub/sectors"
              className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
            >
              {copy('sectorsLinkLabel', 'All sectors')}
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

      {/* ── 3. Meet the speakers ─────────────────────────────────────────── */}

      <SpeakerWall
        speakers={speakers}
        eyebrow={copy('speakersEyebrow', 'Speakers')}
        title={copy('speakersTitle', 'Meet the speakers')}
        lead={copy(
          'speakersLead',
          'The ministers, investors, founders and development partners whose sessions fill the hub.',
        )}
        linkLabel={copy('speakersLinkLabel', 'View all speakers')}
        tone="muted"
      />

      <CtaBand
        title={copy('ctaTitle', 'Members get more of this')}
        lead={copy(
          'ctaLead',
          'Full sector datasets, the Deal Room, and session recordings released to members first.',
        )}
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
