import Link from 'next/link'
import type { Metadata } from 'next'

import { HeroSlider, type HeroSlide } from '@/components/site/hero-slider'
import { ButtonLink } from '@/components/ui/button'
import { Badge, LinkCard } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { CardGrid, Container, Section } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { formatDateShort, truncate } from '@/lib/format'
import {
  getCurrentEvent,
  getPageCopy,
  getSettings,
  setting,
  type PageCopy,
} from '@/lib/settings'

/**
 * Homepage (SDR §4.2).
 *
 * Rebuilt to the composition of the reference page the secretariat gave us
 * (germanyafrica.com). That page opens on the organisation's own news rather
 * than on a statement about itself, and its order is the argument: what we
 * have been doing, then what else we have been doing, then who we are, then
 * what we believe, then how to reach us. The section list below is that order.
 *
 * What is borrowed is the rhythm, not the material. The palette, the
 * typography, the photographs and every word are FBF's own — the reference is
 * a wireframe, and its copy is about Germany. This is the same arrangement the
 * previous homepage had with londonbusinessforum.com, recorded here for the
 * same reason: so a later reader knows which decisions are ours to revisit and
 * which are a client's brief.
 *
 * The bands the previous homepage carried between the hero and the news — the
 * sector grid and the Deal Room teaser — are gone with it, at the
 * secretariat's request and after being asked twice, because the reference
 * page has no equivalent of either. They are not hidden behind a flag: a band
 * nobody asked to keep is better deleted than left switched off, and both
 * subjects keep their own pages, which the header nav and the footer reach.
 * The newsletter band went the same way and the footer still carries the form.
 *
 * The consequence worth naming: this page no longer routes anyone into the
 * Deal Room or the sector guides. Those two were the homepage's only entry
 * points to the features §4.7 and §4.11 describe, and the nav is now carrying
 * that traffic alone.
 *
 * The queries run in one `Promise.all` rather than sequentially. Awaiting them
 * in series would add each round-trip to time-to-first-byte, which is the
 * budget that matters on a 3G handset (NFR-01).
 */

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

/**
 * How many stories the hero rotates through before the grid takes over.
 *
 * Three, because the grid below lays out in threes and the forum has six
 * articles published: three in the hero leaves the grid one full row. Four
 * would leave two cards in a row of three, which reads as a page that ran out
 * rather than one that chose where to stop. Raise it when the archive is
 * deeper — the reference page rotates six.
 */
const SLIDE_COUNT = 3

export default async function HomePage() {
  const [settings, event, copy, articles, photos] = await Promise.all([
    getSettings(),
    getCurrentEvent(),
    getPageCopy('home'),
    db.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 9,
      include: { category: { select: { name: true, slug: true } } },
    }),
    // The forum's own photographs, in the order the secretariat set on the
    // collection. They back the hero slides and stand in for the article
    // thumbnails: no article on file carries a hero image of its own, and a
    // news-led page with no pictures is the reference composition with its
    // point removed.
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
  ])

  /**
   * A picture for the nth story.
   *
   * The gallery is walked in order and wraps when it runs out, so eight
   * photographs dress nine articles without leaving the last one bare. An
   * article that has its own hero image uses that instead — the fallback is
   * for the state the site is actually in, not a rule that images live in the
   * gallery.
   */
  const pictureFor = (index: number, own: string | null): string | null =>
    own ?? (photos.length > 0 ? photos[index % photos.length].url : null)

  const slides: HeroSlide[] = articles.slice(0, SLIDE_COUNT).map(
    (article, index): HeroSlide => ({
      id: article.id,
      href: `/blog/${article.slug}`,
      eyebrow:
        article.category?.name ??
        (article.publishedAt ? formatDateShort(article.publishedAt) : null),
      title: article.title,
      excerpt: truncate(article.excerpt, 160),
      imageUrl: pictureFor(index, article.heroImageUrl),
    }),
  )

  // The stories the hero did not take, capped at two full rows of three.
  const rest = articles.slice(SLIDE_COUNT, SLIDE_COUNT + 6)

  return (
    <>
      {event && <EventStructuredData event={event} />}

      <h1 className="sr-only">
        {setting(settings, 'site.name')} — {setting(settings, 'site.tagline')}
      </h1>

      <HeroSlider slides={slides} />
      <MoreStories
        articles={rest}
        copy={copy}
        pictureFor={pictureFor}
        offset={SLIDE_COUNT}
      />
      <Mission settings={settings} copy={copy} />
      <WhatWeAre copy={copy} />
      <PullQuote copy={copy} photo={photos[0]?.url ?? null} />
      <ContactBand copy={copy} />
    </>
  )
}

// ── 1. The rest of the stories ──────────────────────────────────────────────

/**
 * The news grid under the hero.
 *
 * The reference page runs its remaining articles as cards directly beneath the
 * slider, with no heading between the two — the hero and the grid read as one
 * block of "here is what we have been doing". A heading is offered here all
 * the same, because that page is a think tank publishing weekly and this one
 * is a secretariat publishing occasionally: with six stories on file the grid
 * needs to say what it is, or it reads as the hero repeating itself.
 */
function MoreStories({
  articles,
  copy,
  pictureFor,
  offset,
}: {
  copy: PageCopy
  offset: number
  pictureFor: (index: number, own: string | null) => string | null
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
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-ink-950 sm:text-3xl">
          {copy('newsTitle', 'Latest from the forum')}
        </h2>

        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:text-forest-800 hover:underline"
        >
          {copy('newsLinkLabel', 'All news & insights')}
          <Icon name="arrowRight" className="size-4" />
        </Link>
      </div>

      <CardGrid columns={3} className="mt-10">
        {articles.map((article, index) => {
          const picture = pictureFor(offset + index, article.heroImageUrl)

          return (
            <LinkCard
              key={article.id}
              href={`/blog/${article.slug}`}
              className="h-full"
              padded={false}
            >
              {picture && (
                // Remote CMS URL — see the note in ui/card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={picture}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-48 w-full object-cover"
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
              </div>
            </LinkCard>
          )
        })}
      </CardGrid>
    </Section>
  )
}

// ── 2. What the forum is for ────────────────────────────────────────────────

/**
 * The mission statement — the reference page's "The Meeting Place for
 * German-African Trade & Investment", centred and full width.
 *
 * The heading and body are the `home.introHeading` and `home.introBody`
 * settings, which have been in the database since launch and had no screen
 * rendering them: the band that used to carry them was cut long before this
 * redesign. They are exactly this section, so the redesign puts them back to
 * work rather than asking anyone to write the same paragraph twice.
 *
 * One word of the heading is set in the accent, and which word that is is the
 * copywriter's call rather than the layout's — so the value carries asterisks
 * around it, the convention `home.introHeading` was seeded with.
 */
function Mission({
  settings,
  copy,
}: {
  settings: Record<string, string>
  copy: PageCopy
}) {
  const heading = setting(settings, 'home.introHeading')
  const body = setting(settings, 'home.introBody')

  if (!heading && !body) return null

  return (
    <Section tone="muted">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-forest-700">
          {copy('missionEyebrow', 'The Freetown Business Forum')}
        </p>

        <h2 className="mt-5 font-display text-3xl font-bold leading-tight tracking-tight text-ink-950 sm:text-4xl">
          {emphasise(heading)}
        </h2>

        <p className="mt-6 text-base leading-relaxed text-ink-700 sm:text-lg">
          {body}
        </p>
      </div>
    </Section>
  )
}

/**
 * Split a heading on its `*asterisked*` word and set that part in the accent.
 *
 * Returns an array of nodes rather than markup through
 * `dangerouslySetInnerHTML`, because the value comes from a settings row an
 * editor controls and nothing about a heading justifies handing it a path to
 * inject markup (§14).
 */
function emphasise(heading: string) {
  // The capture group lands on the odd indices — those are the emphasised
  // parts; everything else is the plain text between them.
  return heading
    .split(/\*([^*]+)\*/)
    .map((part, index) =>
      index % 2 === 1 ? (
        <span key={index} className="text-forest-700">
          {part}
        </span>
      ) : (
        part
      ),
    )
}

// ── 3. What kind of organisation this is ────────────────────────────────────

/**
 * The reference page's "A PRIVATE THINK TANK" band: one claim about what the
 * organisation actually is, set as a wide text block on the dark ground.
 *
 * Every word is a CMS block with a fallback, so the secretariat can rewrite
 * the forum's own description of itself without a deployment — which is the
 * whole point of a band that exists to say who we are.
 */
function WhatWeAre({ copy }: { copy: PageCopy }) {
  return (
    <Section tone="ink">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <h2 className="font-display text-3xl font-extrabold uppercase leading-[0.95] tracking-tighter sm:text-4xl">
            {copy('aboutTitle', 'A convening body, not a chamber')}
          </h2>
        </div>

        <div className="space-y-5 text-base leading-relaxed text-white/75 sm:text-lg lg:col-span-7">
          <p>
            {copy(
              'aboutBody',
              'The Freetown Business Forum exists to put Sierra Leonean enterprise in the same room as the capital, the ministries and the partners that decide whether it grows. It is convened by its members and run by a small secretariat: it does not lobby for a single sector, and it does not speak for government. What it does is get the right people into one room, and make sure the meetings that matter are arranged before anyone arrives.',
            )}
          </p>
          <p>
            {copy(
              'aboutBodyTwo',
              'That work runs all year rather than for three days. Membership carries a listing in the national business directory, access to the Deal Room where propositions are matched to investors, and a standing seat in the dialogue with government.',
            )}
          </p>
        </div>
      </div>
    </Section>
  )
}

// ── 4. Pull quote ───────────────────────────────────────────────────────────

/**
 * The reference page's quote band: a single claim at display size over a
 * photograph, with the ground darkened behind it.
 *
 * It runs there twice, back to back, with the same words over different
 * pictures. Once is enough here — the repetition is a quirk of that page's
 * build rather than a decision worth copying, and a second identical band on a
 * shorter page reads as a fault.
 *
 * The band still works without a photograph: the quote sits on the brand
 * ground, which is what a site with an empty gallery gets.
 */
function PullQuote({ copy, photo }: { copy: PageCopy; photo: string | null }) {
  return (
    <section className="relative isolate overflow-hidden bg-forest-900 text-white">
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-forest-950/80"
          />
        </>
      )}

      <Container>
        <div className="mx-auto max-w-3xl py-20 text-center sm:py-24 lg:py-28">
          <Icon
            name="quote"
            className="mx-auto size-10 text-gold-400"
            strokeWidth={1.5}
          />

          <blockquote className="mt-8">
            <p className="font-display text-2xl font-semibold leading-snug tracking-tight sm:text-3xl lg:text-4xl">
              {copy(
                'quote',
                'Sierra Leone is not short of opportunity. It is short of the introductions that turn an opportunity into a deal.',
              )}
            </p>
          </blockquote>

          <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-white/60">
            {copy('quoteAttribution', 'The Freetown Business Forum')}
          </p>
        </div>
      </Container>
    </section>
  )
}

// ── 5. Contact ──────────────────────────────────────────────────────────────

/**
 * The reference page closes on its own name and a single button, and nothing
 * else. That restraint is the point of the band: it is the last thing on the
 * page, so it asks for one action rather than four.
 */
function ContactBand({ copy }: { copy: PageCopy }) {
  return (
    <Section tone="white">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-extrabold uppercase tracking-tighter text-ink-950 sm:text-4xl">
          {copy('contactTitle', 'Contact FBF')}
        </h2>

        <p className="mt-5 text-base leading-relaxed text-ink-700 sm:text-lg">
          {copy(
            'contactLead',
            'Membership, sponsorship, the Deal Room, or a question about attending — this reaches a person, not a queue.',
          )}
        </p>

        <div className="mt-8">
          <ButtonLink
            href="/contact"
            variant="accent"
            size="lg"
            className="rounded-none font-semibold uppercase tracking-wider"
          >
            {copy('contactLabel', 'Contact us')}
            <Icon name="arrowRight" className="size-5" />
          </ButtonLink>
        </div>
      </div>
    </Section>
  )
}

// ── Structured data (NFR-10) ────────────────────────────────────────────────

/**
 * schema.org Event markup, so search engines show the forum's dates and venue
 * directly in results. Rendered as JSON-LD in a script tag — the format Google
 * documents, and the only one that does not require decorating the markup.
 *
 * It survives the redesign even though nothing visible on this page now names
 * the forum's dates: the markup is for the search engine, and the event is
 * still the thing this organisation is known for.
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
