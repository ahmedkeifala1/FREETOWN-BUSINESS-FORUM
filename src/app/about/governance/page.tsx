import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Avatar, Card } from '@/components/ui/card'
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
import { LeadershipGroup } from '@/lib/enums'
import { initials, paragraphs } from '@/lib/format'
import { getPageBlocks } from '@/lib/settings'

/**
 * Governance & structure (SDR §4.3).
 *
 * The people are on /about/leadership; this page is the structure they work
 * within — how the forum is constituted, who answers to whom, and where the
 * money goes. It is the page a development partner or a corporate legal team
 * reads before signing anything, so it is prose and named roles rather than
 * cards and photography.
 *
 * Copy is read from a `governance` CMS page when the secretariat has published
 * one, and falls back to the `governance` block on the About page otherwise —
 * so the route works from the day it ships and improves without a redeploy
 * (FR-01, FR-02).
 */

export const metadata: Metadata = {
  title: 'Governance',
  description:
    'How the Freetown Business Forum is constituted and governed — its board, its officers and its lines of accountability.',
  alternates: { canonical: '/about/governance' },
}

/** The blocks this route renders, in the order they appear. */
const SECTIONS = [
  { key: 'structure', title: 'Structure' },
  { key: 'board', title: 'The board' },
  { key: 'committees', title: 'Committees' },
  { key: 'membership', title: 'Membership and the general meeting' },
  { key: 'finance', title: 'Finance and accountability' },
  { key: 'ethics', title: 'Conduct and conflicts of interest' },
] as const

export default async function GovernancePage() {
  const [governanceBlocks, aboutBlocks, profiles] = await Promise.all([
    getPageBlocks('governance'),
    getPageBlocks('about'),
    db.leadershipProfile.findMany({
      where: {
        isPublished: true,
        group: {
          in: [LeadershipGroup.GOVERNANCE, LeadershipGroup.LEADERSHIP],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ])

  const intro = governanceBlocks.intro ?? aboutBlocks.governance ?? ''
  const sections = SECTIONS.filter(({ key }) => governanceBlocks[key])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about' },
          { label: 'Governance', href: '/about/governance' },
        ]}
      />

      <PageHero
        eyebrow="About"
        title="How the forum is"
        accent="governed"
        lead="FBF is a non-profit. It is accountable to its members for what it does with their subscriptions, and to its partners for what it does with their support."
      />

      {intro && (
        <Section tone="white" size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <SectionHeading eyebrow="In short" title="Who leads the forum" />
            </div>

            <div className="space-y-4 text-lg leading-relaxed text-ink-800 lg:col-span-7">
              {paragraphs(intro).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </Section>
      )}

      {profiles.length > 0 && (
        <Section tone="muted" size="wide">
          <SectionHeading
            eyebrow="Accountable officers"
            title="The board and officers"
            lead="Each officer below is accountable to the membership for the part of the forum named against their role."
          />

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
                  <p className="mt-4 text-sm leading-relaxed text-ink-600">
                    {paragraphs(profile.bio)[0]}
                  </p>
                )}
              </Card>
            ))}
          </CardGrid>

          <p className="mt-8 text-sm text-ink-600">
            Full profiles are on the{' '}
            <Link
              href="/about/leadership"
              className="font-medium text-forest-700 hover:underline"
            >
              leadership page
            </Link>
            .
          </p>
        </Section>
      )}

      {sections.length > 0 && (
        <Section tone="white">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            {/*
              A contents rail rather than a floating widget: this page is read
              by people looking for one specific clause, and a plain list of
              in-page anchors is both the cheapest and the most accessible way
              to get them there (NFR-01, NFR-09).
            */}
            <nav aria-label="On this page" className="lg:col-span-4">
              <p className="text-sm font-semibold uppercase tracking-wider text-forest-700">
                On this page
              </p>
              <ul className="mt-4 space-y-2.5 border-l border-ink-200 pl-4 text-sm">
                {sections.map(({ key, title }) => (
                  <li key={key}>
                    <a
                      href={`#${key}`}
                      className="text-ink-700 hover:text-forest-700 hover:underline"
                    >
                      {title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-10 lg:col-span-8">
              {sections.map(({ key, title }) => (
                <section
                  key={key}
                  id={key}
                  className="scroll-mt-28 border-t border-ink-200 pt-8 first:border-t-0 first:pt-0"
                >
                  <h2 className="text-xl text-ink-950 sm:text-2xl">{title}</h2>
                  <div className="mt-4 space-y-4 leading-relaxed text-ink-700">
                    {paragraphs(governanceBlocks[key]).map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/*
        Documents the secretariat can hand over on request. Naming the request
        route is more honest than a downloads grid that would 404 — the
        constitution and the accounts are not published on the site yet.
      */}
      <Section tone="muted">
        <SectionHeading
          eyebrow="On request"
          title="Governance documents"
          lead="Not published on the site. The secretariat sends any of these by email on request, including to partners carrying out due diligence."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <RequestCard
            icon="document"
            title="Constitution"
            body="The founding document, setting out the forum’s objects, its membership classes and how officers are elected."
          />
          <RequestCard
            icon="shield"
            title="Annual report & accounts"
            body="What the forum did in the year and what it cost, including subscription and registration income."
          />
          <RequestCard
            icon="users"
            title="Board minutes"
            body="Resolutions of the board, available to members in good standing."
          />
        </div>
      </Section>

      <CtaBand
        title="Questions about how we are run?"
        lead="The secretariat answers governance enquiries directly."
        tone="harbour"
      >
        <ButtonLink href="/contact" variant="accent" size="lg">
          Contact the secretariat
        </ButtonLink>
        <ButtonLink
          href="/about/partners"
          size="lg"
          className="border border-white/30 bg-white/10 text-white hover:bg-white/20 active:bg-white/25"
        >
          Our partners
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function RequestCard({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  return (
    <Card className="h-full">
      <Icon name={icon} className="size-7 text-forest-600" />
      <h3 className="mt-4 font-display text-base font-semibold text-ink-950">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
    </Card>
  )
}
