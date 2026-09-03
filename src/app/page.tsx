import Link from 'next/link'
import type { Metadata } from 'next'

import { HeroMosaic, type MosaicTile } from '@/components/site/hero-mosaic'
import { MembershipTabs, type MembershipTab } from '@/components/site/membership-tabs'
import { NewsletterForm } from '@/components/site/newsletter-form'
import { ButtonLink } from '@/components/ui/button'
import { Badge, LinkCard } from '@/components/ui/card'
import { Icon, type IconName } from '@/components/ui/icon'
import {
  CardGrid,
  Container,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import {
  formatDateShort,
  parseJsonColumn,
  truncate,
} from '@/lib/format'
import { formatMoney } from '@/lib/money'
import {
  getCurrentEvent,
  getPageCopy,
  getSectors,
  getSettings,
  setting,
  type PageCopy,
} from '@/lib/settings'

/**
 * Homepage (SDR §4.2).
 *
 * Every band on this page is read from the database — the hero, the sector
 * grid, the Deal Room and membership teasers and the news cards (FR-01) — and
 * since the page editor gained the `home` entry, so is the wording around
 * them. The section headings below are still written in this file, but as
 * *fallbacks*: `copy(key, fallback)` prefers what the secretariat has written
 * and uses the line here when they have written nothing. See `getPageCopy`
 * for why the words stay in the source rather than moving to a seed.
 *
 * The layout follows the reference the secretariat gave us
 * (londonbusinessforum.com): a statement hero with a cycling phrase, then the
 * routes into the site, with membership as tabs rather than four price cards.
 * The palette, typography and section list stay as specified in §3.2/§4.2 —
 * this is that page's rhythm, not its brand.
 *
 * The secretariat has since cut seven of the bands §4.2 lists: the six that
 * ran between the hero and the sector grid — the endorsements, the statement
 * and its stat counters, the programme highlights, the film band, the speaker
 * wall and "who should attend" — and the sponsor strip that closed the page.
 * They are not hidden behind a flag or an empty-state guard: a band nobody
 * asked to keep is better deleted than left switched off, and the material
 * they showed all still has its own page (`/events/agenda`,
 * `/events/speakers`, `/events/sponsors`, `/learning-hub/recordings`,
 * `/about`), which the header and the teasers below already reach. The
 * section numbering below keeps its gaps closed, so what is left reads in
 * order.
 *
 * Note that the sponsor strip took the page's only "Become a sponsor" call to
 * action with it — including the one it showed in place of the strip when an
 * edition had no sponsors signed yet. `/events/sponsors` is now reached from
 * the footer's Events column, or from `/events` itself; the main nav has no
 * direct entry for it.
 *
 * The queries run in two `Promise.all` batches rather than sequentially.
 * Awaiting them in series would add each round-trip to time-to-first-byte,
 * which is the budget that matters on a 3G handset (NFR-01).
 */

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const [settings, event, sectors, copy] = await Promise.all([
    getSettings(),
    getCurrentEvent(),
    getSectors(),
    getPageCopy('home'),
  ])

  const [
    galleryPhotos,
    articles,
    tiers,
    opportunities,
    videos,
  ] = await Promise.all([
    // The hero mosaic. The forum's own photographs, in the order the
    // secretariat set on the collection — twelve is more than the wall shows
    // at any viewport, so removing one never opens a hole in the composition.
    db.mediaAsset.findMany({
      where: {
        isPublic: true,
        kind: 'GALLERY',
        collection: { slug: 'forum-gallery', isPublished: true },
      },
      orderBy: { sortOrder: 'asc' },
      take: 12,
      select: { id: true, url: true },
    }),
    db.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: { category: { select: { name: true, slug: true } } },
    }),
    db.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.opportunity.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      take: 3,
      include: { sector: { select: { name: true } } },
    }),
    // The forum's own footage, in the secretariat's order, for the hero
    // mosaic. Only self-hosted files are taken: the rest of the video
    // collection lives on a platform whose player a decorative tile has no
    // business embedding, and those belong on the recordings page where they
    // are linked out to their host. Four is more than the wall places, so a
    // fifth upload never lands in the hero unasked.
    db.mediaAsset.findMany({
      where: {
        isPublic: true,
        kind: 'VIDEO',
        url: { startsWith: '/' },
        collection: { slug: 'forum-videos', isPublished: true },
      },
      orderBy: { sortOrder: 'asc' },
      take: 4,
      select: {
        id: true,
        url: true,
        title: true,
        caption: true,
        altText: true,
        thumbnailUrl: true,
      },
    }),
  ])

  return (
    <>
      {event && <EventStructuredData event={event} />}

      <Hero
        settings={settings}
        event={event}
        tiles={buildMosaic(galleryPhotos, videos)}
      />
      <Sectors sectors={sectors} copy={copy} />
      <DealRoomTeaser opportunities={opportunities} copy={copy} />
      <MembershipTeaser tiers={tiers} copy={copy} />
      <LatestNews articles={articles} copy={copy} />
      <NewsletterBand settings={settings} copy={copy} />
    </>
  )
}

/**
 * Interleave the gallery photographs with the forum's clips for the hero
 * mosaic.
 *
 * The wall used to carry three flat tiles stating the delegate, country and
 * sector counts. It no longer does — the secretariat would rather the fold
 * showed the forum itself — so the positions those tiles held now go to
 * footage, and the rest of the wall to photographs. The figures themselves had
 * moved to the stats band below the hero, which has since been cut with it;
 * they are on `/about` and in the event's own pages, not on this page at all.
 *
 * A clip lands every fourth tile, which in a three-column grid means no two of
 * them ever share a row or sit directly above one another — the block reads as
 * scattered without being randomised, and a random layout would differ between
 * the server render and the client's (NFR-01). It also keeps the clips clear
 * of the positions the mosaic enlarges; see FEATURE_POSITIONS.
 *
 * Everything past the photographs is appended rather than dropped, so a wall
 * with more clips than places for them still shows all of them — and a site
 * with no video on file simply gets the photographs, with no hole where a
 * tile was expected.
 */
function buildMosaic(
  photos: Array<{ id: string; url: string }>,
  videos: Array<{ id: string; url: string; thumbnailUrl: string | null }>,
): MosaicTile[] {
  const clips: MosaicTile[] = videos.map((video) => ({
    kind: 'video',
    id: video.id,
    url: video.url,
    posterUrl: video.thumbnailUrl,
  }))

  const photographs: MosaicTile[] = photos.map((photo) => ({
    kind: 'photo',
    id: photo.id,
    url: photo.url,
  }))

  const tiles: MosaicTile[] = []
  let nextClip = 0

  for (const photograph of photographs) {
    if (tiles.length % 4 === 3 && nextClip < clips.length) {
      tiles.push(clips[nextClip])
      nextClip += 1
    }
    tiles.push(photograph)
  }

  return tiles.concat(clips.slice(nextClip))
}

// ── 1. Hero ─────────────────────────────────────────────────────────────────

/**
 * The statement hero (§4.2), built to the composition of the reference page
 * the secretariat gave us.
 *
 * Near-black ground; a lead-in line and three stacked words at display size
 * with the last in the accent, which is the whole left half. The right half is
 * a colour panel carrying a crawl of sector names, with the strongest
 * endorsement laid over it — proof sits inside the hero rather than waiting in
 * a band below the fold.
 *
 * The panel is absolutely positioned on `lg` so it reaches the right edge of
 * the viewport without any `100vw` arithmetic, which overflows by the width of
 * the scrollbar on Windows. Below `lg` it returns to normal flow and stacks
 * under the headline, after the call to action rather than before it.
 */
function Hero({
  settings,
  event,
  tiles,
}: {
  settings: Record<string, string>
  event: Awaited<ReturnType<typeof getCurrentEvent>>
  tiles: MosaicTile[]
}) {
  const statement = setting(settings, 'home.heroStatement')
  const words = setting(settings, 'home.heroWords')
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 3)

  return (
    <section className="relative isolate overflow-hidden bg-ink-950 text-white">
      <Container size="wide">
        <div className="py-14 sm:py-20 lg:w-[54%] lg:py-28 lg:pr-10">
          {/* One mark per word, stacked in a single grid cell and cross-faded
              on the same loop as the words. The reference page changes the
              glyph and the hue together as the highlight moves, so the mark
              above the headline always belongs to the word currently lit. */}
          {words.length > 0 && (
            <span aria-hidden="true" className="grid w-fit">
              {words.map((word, index) => {
                const { icon, accent } = HERO_CYCLE[index % HERO_CYCLE.length]
                return (
                  <Icon
                    key={word}
                    name={icon}
                    strokeWidth={1.5}
                    className="hero-cycle-icon size-14 sm:size-16"
                    style={{
                      animationDelay: `${index * 3}s`,
                      color: `var(${accent})`,
                    }}
                  />
                )
              })}
            </span>
          )}

          <h1 className="mt-7">
            {/* The lead-in is the smaller line above the stack — "delivering
                ideas that" — and the three words complete the sentence. */}
            <span className="block font-display text-2xl font-semibold uppercase leading-tight tracking-tight text-white sm:text-3xl">
              {statement}
            </span>

            <span className="mt-3 block font-display text-6xl font-extrabold uppercase leading-[0.88] tracking-tighter sm:text-7xl lg:text-[5.5rem]">
              {words.map((word, index) => (
                <span
                  key={word}
                  className="hero-cycle-word block text-white"
                  style={{
                    animationDelay: `${index * 3}s`,
                    // Read by the keyframes; each word lights in the hue of
                    // the mark that comes up with it.
                    ['--hero-accent' as string]: `var(${
                      HERO_CYCLE[index % HERO_CYCLE.length].accent
                    })`,
                  }}
                >
                  {word}
                </span>
              ))}
            </span>
          </h1>

          <p className="mt-8 max-w-lg text-base leading-relaxed text-white/75 sm:text-lg">
            {event?.tagline ?? setting(settings, 'site.tagline')}
          </p>

        </div>
      </Container>

      {/* The mosaic runs off the bottom and right of the viewport rather than
          fitting itself to the hero — the tiles reading as a wall that
          continues past the edge is the point of the composition. */}
      <div className="relative min-h-104 bg-ink-900 lg:absolute lg:inset-y-0 lg:right-0 lg:w-[46%] lg:min-h-0">
        <HeroMosaic tiles={tiles} />
      </div>
    </section>
  )
}

/**
 * The mark and the highlight, one pair per word, in the order the cycle runs
 * them. The reference page moves both together — a purple face over "excite",
 * a red rocket over "motivate" — so it is the pairing being followed here,
 * not the colours on their own.
 *
 * The lamp and gold lead. The screenshots the secretariat sent caught only
 * two of the three states, and gold is the brand accent (§3.2), so the state
 * we could not see stays inside the FBF palette rather than inventing a third
 * borrowed hue; `plum` and `ember` are the reference's own and live nowhere
 * else on the site (see `globals.css`).
 *
 * Positional rather than keyed by word: the three words are editable from the
 * admin panel, so nothing here may depend on what they say.
 */
const HERO_CYCLE: Array<{ icon: IconName; accent: string }> = [
  { icon: 'lightbulb', accent: '--color-gold-400' },
  { icon: 'smile', accent: '--color-plum-500' },
  { icon: 'rocket', accent: '--color-ember-500' },
]

// ── 2. Sectors ──────────────────────────────────────────────────────────────

function Sectors({
  sectors,
  copy,
}: {
  sectors: Array<{
    id: string
    slug: string
    name: string
    summary: string
    iconKey: string
  }>
  copy: PageCopy
}) {
  if (sectors.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <SectionHeading
        eyebrow={copy('sectorsEyebrow', 'Opportunities')}
        title={copy('sectorsTitle', 'Eight sectors, one investment case')}
        lead={copy(
          'sectorsLead',
          'Each sector page sets out the data, the incentives on offer, and the live opportunities seeking capital.',
        )}
      />

      <CardGrid columns={4} className="mt-10">
        {sectors.map((sector) => (
          <LinkCard key={sector.id} href={`/learning-hub/sectors/${sector.slug}`}>
            <span className="flex size-11 items-center justify-center rounded-lg bg-harbour-50 text-harbour-700">
              <Icon name={sector.iconKey} className="size-5" />
            </span>
            <h3 className="mt-4 font-display text-base font-semibold text-ink-950 group-hover:text-forest-700">
              {sector.name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {truncate(sector.summary, 130)}
            </p>
          </LinkCard>
        ))}
      </CardGrid>
    </Section>
  )
}

// ── 3. Deal Room teaser ─────────────────────────────────────────────────────

function DealRoomTeaser({
  opportunities,
  copy,
}: {
  copy: PageCopy
  opportunities: Array<{
    id: string
    slug: string
    title: string
    summary: string
    region: string | null
    currency: string
    ticketSizeMinMinor: number | null
    ticketSizeMaxMinor: number | null
    sector: { name: string } | null
  }>
}) {
  return (
    <Section tone="harbour" size="wide">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <SectionHeading
            eyebrow={copy('dealRoomEyebrow', 'Deal Room')}
            title={copy('dealRoomTitle', 'Capital and businesses, in the same room')}
            lead={copy(
              'dealRoomLead',
              'Businesses submit propositions; investors request access. The secretariat matches both sides and schedules the meetings in advance, so the second day of the forum is spent talking rather than looking.',
            )}
            inverted
          />

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <ButtonLink href="/deal-room/apply" variant="accent" size="md">
              {copy('dealRoomApplyLabel', 'Apply for funding')}
            </ButtonLink>
            <ButtonLink
              href="/deal-room"
              size="md"
              className="border border-white/30 bg-white/10 text-white hover:bg-white/20"
            >
              {copy('dealRoomBrowseLabel', 'Browse opportunities')}
            </ButtonLink>
          </div>
        </div>

        {opportunities.length > 0 && (
          <ul className="space-y-4 lg:col-span-7">
            {opportunities.map((opportunity) => (
              <li key={opportunity.id}>
                <Link
                  href={`/deal-room/${opportunity.slug}`}
                  className="group block rounded-xl border border-white/15 bg-white/5 p-5 transition hover:border-white/35 hover:bg-white/10"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {opportunity.sector && (
                      <Badge className="bg-white/10 text-white ring-white/20">
                        {opportunity.sector.name}
                      </Badge>
                    )}
                    {opportunity.region && (
                      <span className="text-xs text-white/60">
                        {opportunity.region}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2.5 font-display text-base font-semibold text-white group-hover:text-gold-300">
                    {opportunity.title}
                  </h3>

                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                    {truncate(opportunity.summary, 150)}
                  </p>

                  {opportunity.ticketSizeMinMinor !== null && (
                    <p className="mt-3 text-sm font-medium text-gold-300">
                      Seeking{' '}
                      {formatMoney(
                        opportunity.ticketSizeMinMinor,
                        opportunity.currency === 'USD' ? 'USD' : 'SLE',
                        { compact: true },
                      )}
                      {opportunity.ticketSizeMaxMinor
                        ? ` – ${formatMoney(
                            opportunity.ticketSizeMaxMinor,
                            opportunity.currency === 'USD' ? 'USD' : 'SLE',
                            { compact: true },
                          )}`
                        : ''}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

// ── 4. Membership teaser ────────────────────────────────────────────────────

function MembershipTeaser({
  tiers,
  copy,
}: {
  copy: PageCopy
  tiers: Array<{
    id: string
    slug: string
    name: string
    strapline: string | null
    priceMinor: number
    currency: string
    featuresJson: string
  }>
}) {
  if (tiers.length === 0) return null

  const tabs: MembershipTab[] = tiers.map((tier) => ({
    id: tier.id,
    slug: tier.slug,
    name: tier.name,
    strapline: tier.strapline,
    price: formatMoney(
      tier.priceMinor,
      tier.currency === 'USD' ? 'USD' : 'SLE',
      { compact: true },
    ),
    features: parseJsonColumn<string[]>(tier.featuresJson, []),
  }))

  return (
    <Section tone="muted" size="wide">
      <SectionHeading
        eyebrow={copy('membershipEyebrow', 'Membership')}
        title={copy('membershipTitle', 'Join FBF')}
        lead={copy(
          'membershipLead',
          'Membership carries a directory listing, member rates on forum registration, access to the Deal Room, and a standing seat in the dialogue with government.',
        )}
        align="center"
      />

      <MembershipTabs tabs={tabs} />
    </Section>
  )
}

// ── 5. Latest news ──────────────────────────────────────────────────────────

function LatestNews({
  articles,
  copy,
}: {
  copy: PageCopy
  articles: Array<{
    id: string
    slug: string
    title: string
    excerpt: string
    publishedAt: Date | null
    heroImageUrl: string | null
    category: { name: string; slug: string } | null
  }>
}) {
  if (articles.length === 0) return null

  return (
    <Section tone="white" size="wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow={copy('newsEyebrow', 'News')}
          title={copy('newsTitle', 'Latest from the forum')}
          className="mb-0"
        />
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:text-forest-800 hover:underline"
        >
          {copy('newsLinkLabel', 'All news & insights')}
          <Icon name="arrowRight" className="size-4" />
        </Link>
      </div>

      <CardGrid columns={3} className="mt-8">
        {articles.map((article) => (
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
                className="h-44 w-full rounded-t-xl object-cover"
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
    </Section>
  )
}

// ── 6. Newsletter ──────────────────────────────────────────────────────────

function NewsletterBand({
  settings,
  copy,
}: {
  settings: Record<string, string>
  copy: PageCopy
}) {
  return (
    <Section tone="forest">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-2xl text-white sm:text-3xl">
          {copy('newsletterTitle', 'Get the monthly briefing')}
        </h2>
        <p className="mt-3 text-white/80">
          {setting(
            settings,
            'newsletter.blurb',
            'Investment opportunities, policy changes and forum news — once a month.',
          )}
        </p>
        <NewsletterForm className="mt-6 text-left" source="homepage" />
      </div>
    </Section>
  )
}

// ── Structured data (NFR-10) ────────────────────────────────────────────────

/**
 * schema.org Event markup, so search engines show the forum's dates and venue
 * directly in results. Rendered as JSON-LD in a script tag — the format Google
 * documents, and the only one that does not require decorating the markup.
 */
function EventStructuredData({
  event,
}: {
  event: NonNullable<Awaited<ReturnType<typeof getCurrentEvent>>>
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fbf.sl'

  const payload = {
    '@context': 'https://schema.org',
    '@type': 'BusinessEvent',
    name: event.name,
    description: event.description ?? event.theme,
    startDate: event.startDate.toISOString(),
    endDate: event.endDate.toISOString(),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venueName,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.venueAddress,
        addressLocality: event.city,
        addressCountry: event.country,
      },
    },
    organizer: {
      '@type': 'Organization',
      name: 'Freetown Business Forum',
      url: siteUrl,
    },
    url: `${siteUrl}/events`,
  }

  return (
    <script
      type="application/ld+json"
      // The payload is built from database columns, not user input, and
      // JSON.stringify escapes the string values it contains.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}
