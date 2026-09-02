import type { Metadata } from 'next'

import { Breadcrumbs, Container } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import { paragraphs } from '@/lib/format'
import { getPageBlocks, getSettings, setting } from '@/lib/settings'

/**
 * About — vision, mandate and the forum's story (SDR §4.3).
 *
 * Two things, in the order the reference site puts them
 * (londonbusinessforum.com/about): a statement of what the forum is and what
 * it is for, and then the institutional history told year by year in
 * alternating split panels. Nothing else. A visitor deciding whether to trust
 * the forum with a registration fee or a membership subscription is really
 * asking "how long has this been going and what has it actually done", and a
 * timeline answers that in a way a fact sheet cannot.
 *
 * The reference's About page ends at the last year of its timeline, and so
 * does this one, at the secretariat's request. Two things §4.3 lists are
 * therefore deliberately absent and must not be reinstated as oversights:
 *
 *  - the vision and the mandate are not a band of their own. They are the
 *    second and third paragraphs of the opening statement, which is the whole
 *    of the reference's own opening — the prose §4.3 asks for is all present,
 *    it is simply read as one statement rather than two labelled columns;
 *  - there is no CTA band and no onward set of links to leadership, governance
 *    and partners. Those three pages are reached from the About column of the
 *    footer, which carries all four routes on every page of the site.
 *
 * All copy is read from the database: the opening blocks from the `about` CMS
 * page, the timeline from the `milestones` table (§4.3, FR-01).
 */

export const metadata: Metadata = {
  title: 'About us',
  description:
    'The Freetown Business Forum — what it is for, how it is run, and how it got here.',
  alternates: { canonical: '/about' },
}

type Milestone = {
  id: string
  year: string
  title: string
  body: string
  imageUrl: string | null
  imageAlt: string | null
}

export default async function AboutPage() {
  const [settings, blocks, milestones] = await Promise.all([
    getSettings(),
    getPageBlocks('about'),
    db.milestone.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about' },
        ]}
      />

      <AboutHeader settings={settings} blocks={blocks} />
      <Story milestones={milestones} />
    </>
  )
}

// ── 1. The opening statement ────────────────────────────────────────────────

/**
 * The headline and the statement under it — the whole of the page before the
 * timeline starts.
 *
 * Three blocks read as one piece of prose. `intro` says what the forum is,
 * `vision` says what it is for, and `mandate` is the list of things that
 * commits it to; they are set at descending weight so the eye is carried down
 * them in that order rather than made to choose between two columns. An
 * unlabelled statement is what the reference does, and labels would be the
 * fact sheet this page is deliberately not.
 *
 * Any of the three may be missing — the blocks are CMS rows and an editor may
 * clear one — so each is rendered only when it has copy, and the intro falls
 * back to the site tagline rather than leaving the page with a bare heading.
 */
function AboutHeader({
  settings,
  blocks,
}: {
  settings: Record<string, string>
  blocks: Record<string, string>
}) {
  return (
    <section className="bg-white pt-10 pb-12 sm:pt-14 sm:pb-16">
      <Container>
        <div className="max-w-3xl">
          <h1 className="text-4xl leading-[1.1] text-ink-950 sm:text-5xl lg:text-6xl">
            About us
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-ink-700 sm:text-xl">
            {blocks.intro ?? setting(settings, 'site.tagline')}
          </p>

          {blocks.vision && (
            <p className="mt-6 font-display text-xl font-semibold leading-snug text-ink-950 sm:text-2xl">
              {blocks.vision}
            </p>
          )}

          {blocks.mandate && (
            <div className="mt-6 space-y-4 leading-relaxed text-ink-700">
              {paragraphs(blocks.mandate).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}

// ── 2. Our story ────────────────────────────────────────────────────────────

function Story({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) return null

  return (
    <section aria-labelledby="our-story">
      <Container className="pt-12 sm:pt-16 lg:pt-20">
        <div className="max-w-3xl border-t border-ink-200 pt-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-forest-700">
            Our story
          </p>
          <h2 id="our-story" className="text-2xl sm:text-3xl lg:text-4xl">
            How the forum got here
          </h2>
        </div>
      </Container>

      <ol>
        {milestones.map((milestone, index) => (
          <StoryPanel
            key={milestone.id}
            milestone={milestone}
            /*
             * The alternation is decorative, and it is driven by position in
             * the list rather than stored on the row — the secretariat should
             * be able to reorder or delete a milestone without the layout
             * developing two images in a row.
             */
            flipped={index % 2 === 1}
            tone={index % 2 === 1 ? 'muted' : 'white'}
          />
        ))}
      </ol>
    </section>
  )
}

function StoryPanel({
  milestone,
  flipped,
  tone,
}: {
  milestone: Milestone
  flipped: boolean
  tone: 'white' | 'muted'
}) {
  return (
    <li className={tone === 'muted' ? 'bg-ink-50' : 'bg-white'}>
      <Container className="py-10 sm:py-14">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div className={cn(flipped && 'lg:order-2')}>
            {/*
              Year and title are one heading rather than two elements, so a
              screen reader announces "2019, The first Deal Room" as a single
              landmark and the outline of the page stays flat.
            */}
            <h3>
              <span className="block font-display text-3xl font-bold text-forest-600 sm:text-4xl">
                {milestone.year}
              </span>
              <span className="mt-2 block text-xl text-ink-950 sm:text-2xl">
                {milestone.title}
              </span>
            </h3>

            <div className="mt-5 space-y-4 leading-relaxed text-ink-700">
              {paragraphs(milestone.body).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className={cn(flipped && 'lg:order-1')}>
            <StoryImage milestone={milestone} />
          </div>
        </div>
      </Container>
    </li>
  )
}

/**
 * The panel image, or a placeholder standing in for one.
 *
 * The brief calls for authentic Sierra Leonean photography (§3.4) and the
 * secretariat's image library is not yet licensed. A stock photograph would be
 * both wrong and a needless download, and a broken image icon looks unfinished
 * — so an untitled milestone gets a tinted panel carrying its own year. Setting
 * `imageUrl` on the row replaces it with no code change.
 */
function StoryImage({ milestone }: { milestone: Milestone }) {
  if (milestone.imageUrl) {
    return (
      // CMS image URLs are arbitrary remote hosts, which next/image would need
      // allow-listed in next.config.ts — see the note in ui/card.tsx.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={milestone.imageUrl}
        alt={milestone.imageAlt ?? ''}
        loading="lazy"
        decoding="async"
        className="aspect-[4/3] w-full rounded-2xl bg-ink-100 object-cover shadow-sm"
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-forest-900 bg-[radial-gradient(ellipse_at_top_left,var(--color-forest-700),transparent_60%),radial-gradient(ellipse_at_bottom_right,var(--color-harbour-800),transparent_60%)]"
    >
      <span className="font-display text-5xl font-bold text-white/15 sm:text-7xl">
        {milestone.year}
      </span>
    </div>
  )
}
