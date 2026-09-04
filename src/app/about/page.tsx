import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Avatar, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { Breadcrumbs, CardGrid, Section } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { LeadershipGroup } from '@/lib/enums'
import { initials, paragraphs } from '@/lib/format'
import {
  getPageBlocks,
  getPageCopy,
  getSettings,
  setting,
  type PageCopy,
} from '@/lib/settings'

/**
 * About (SDR §4.3).
 *
 * Rebuilt to the composition of the reference page the secretariat gave us
 * (germanyafrica.com/about), which is three sections and nothing else: what
 * kind of organisation this is, who runs it, and an invitation to get in
 * touch. The rhythm is borrowed; the palette, typography and every word are
 * FBF's own, exactly as on the homepage — see the note there.
 *
 * What that replaced, and why it is not an oversight:
 *
 *  - **The milestone timeline is gone.** The page used to tell the forum's
 *    institutional history year by year in alternating split panels, following
 *    londonbusinessforum.com. The reference has no equivalent, and only one
 *    milestone was ever published, so the band was a scaffold holding a single
 *    entry. The `milestones` table and its rows are untouched, but **nothing
 *    on the site reads them now** — it never had an admin screen either, so a
 *    milestone added to the database would go nowhere. Restoring the band is
 *    the fix, not adding rows.
 *  - **The team is now on this page.** The reference carries its people here
 *    rather than on a page of their own. `/about/leadership` still exists and
 *    still carries the fuller treatment — both groups, split and labelled —
 *    and the footer still links it. This band is the summary the reference
 *    puts on About, not a replacement for that page.
 *
 * The opening blocks come from the `about` CMS page and the people from the
 * `leadership_profiles` table (FR-01), so both are edited without a deploy.
 */

export const metadata: Metadata = {
  title: 'About us',
  description:
    'The Freetown Business Forum — what it is for, how it is run, and who runs it.',
  alternates: { canonical: '/about' },
}

export default async function AboutPage() {
  const [settings, blocks, copy, profiles, photos] = await Promise.all([
    getSettings(),
    getPageBlocks('about'),
    getPageCopy('about'),
    db.leadershipProfile.findMany({
      where: {
        isPublished: true,
        group: { in: [LeadershipGroup.LEADERSHIP, LeadershipGroup.SECRETARIAT] },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        role: true,
        photoUrl: true,
        bio: true,
      },
    }),
    // One photograph for the opening band. The reference sets an image beside
    // its statement, and the forum's own record is the only honest source for
    // one — a stock photograph beside a claim about convening power would undo
    // the claim (§3.4).
    db.mediaAsset.findFirst({
      where: {
        isPublic: true,
        kind: 'GALLERY',
        collection: { slug: 'forum-gallery', isPublished: true },
      },
      orderBy: { sortOrder: 'asc' },
      select: { url: true, altText: true },
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

      <WhoWeAre settings={settings} blocks={blocks} copy={copy} photo={photos} />
      <Team profiles={profiles} copy={copy} />
      <WorkTogether copy={copy} />
    </>
  )
}

// ── 1. What kind of organisation this is ────────────────────────────────────

/**
 * The opening statement — the reference's "A Private Think Tank": a heading, a
 * rule under it, the prose, and a photograph alongside.
 *
 * Three CMS blocks read as one piece of prose rather than as a labelled fact
 * sheet. `intro` says what the forum is, `vision` says what it is for, and
 * `mandate` is what it commits to; they are set at descending weight so the
 * eye is carried down them in that order. Any of the three may be missing —
 * they are CMS rows and an editor may clear one — so each renders only when it
 * has copy, and the intro falls back to the site tagline rather than leaving
 * the page with a bare heading.
 */
function WhoWeAre({
  settings,
  blocks,
  copy,
  photo,
}: {
  settings: Record<string, string>
  blocks: Record<string, string>
  copy: PageCopy
  photo: { url: string; altText: string | null } | null
}) {
  return (
    <Section tone="white" size="wide">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <h1 className="font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter text-ink-950 sm:text-5xl">
            {copy('heroTitle', 'A convening body, not a chamber')}
          </h1>

          {/* The rule under the heading is the reference's divider. */}
          <div
            aria-hidden="true"
            className="mt-8 h-1 w-20 bg-gold-500"
          />

          <p className="mt-8 text-lg leading-relaxed text-ink-700 sm:text-xl">
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

        {photo && (
          <div className="lg:col-span-5">
            {/*
              Plain `<img>` rather than next/image, as everywhere the address
              comes from the media library: it may point at any host, including
              the blob store, and the optimiser refuses a domain not configured
              ahead of time. The alt text is the secretariat's own where they
              wrote one; without it the photograph is decorative and the prose
              beside it is the content.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.altText ?? ''}
              loading="lazy"
              decoding="async"
              className="h-full max-h-128 w-full object-cover"
            />
          </div>
        )}
      </div>
    </Section>
  )
}

// ── 2. The people ───────────────────────────────────────────────────────────

/**
 * The team, as the reference puts it on this page: a heading, a rule, then one
 * card per person carrying their photograph, their name, their role and their
 * biography.
 *
 * The reference runs long biographies. Ours are shown when they exist and the
 * card simply closes after the role when they do not, which is the state the
 * site is in — no profile on file carries a biography or a photograph yet, so
 * every card currently shows initials on brand colour and two lines. That is
 * honest rather than padded, and both fields are editable, so the band fills
 * out as the secretariat writes them.
 *
 * Both groups are shown together and unlabelled here. The split between the
 * officers and the secretariat is a real distinction and it is made properly
 * on `/about/leadership`; on this page it would be two headings over five
 * people.
 */
function Team({
  profiles,
  copy,
}: {
  copy: PageCopy
  profiles: Array<{
    id: string
    name: string
    role: string
    photoUrl: string | null
    bio: string | null
  }>
}) {
  if (profiles.length === 0) return null

  return (
    <Section tone="muted" size="wide">
      <h2 className="font-display text-3xl font-extrabold uppercase tracking-tighter text-ink-950 sm:text-4xl">
        {copy('teamTitle', 'The FBF team')}
      </h2>

      <div aria-hidden="true" className="mt-6 h-1 w-20 bg-gold-500" />

      <CardGrid columns={3} className="mt-10">
        {profiles.map((profile) => (
          <Card key={profile.id} className="h-full">
            <div className="flex items-start gap-4">
              <Avatar
                src={profile.photoUrl}
                name={profile.name}
                initials={initials(profile.name)}
                size="md"
              />

              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold leading-snug text-ink-950">
                  {profile.name}
                </h3>
                <p className="mt-1 text-sm text-forest-700">{profile.role}</p>
              </div>
            </div>

            {profile.bio && (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-600">
                {paragraphs(profile.bio).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
          </Card>
        ))}
      </CardGrid>
    </Section>
  )
}

// ── 3. Get in touch ─────────────────────────────────────────────────────────

/**
 * The reference closes About on two words and a button, and nothing else.
 * That restraint is the point of the band.
 */
function WorkTogether({ copy }: { copy: PageCopy }) {
  return (
    <Section tone="ink">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-extrabold uppercase tracking-tighter sm:text-4xl">
          {copy('ctaTitle', 'Let’s work together')}
        </h2>

        <p className="mt-5 text-base leading-relaxed text-white/75 sm:text-lg">
          {copy(
            'ctaLead',
            'Membership, partnership, sponsorship, or a question about the forum — this reaches a person, not a queue.',
          )}
        </p>

        <div className="mt-8">
          <ButtonLink
            href="/contact"
            variant="accent"
            size="lg"
            className="rounded-none font-semibold uppercase tracking-wider"
          >
            {copy('ctaLabel', 'Get in touch')}
            <Icon name="arrowRight" className="size-5" />
          </ButtonLink>
        </div>
      </div>
    </Section>
  )
}
