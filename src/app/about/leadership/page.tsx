import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Avatar, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
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
import { LeadershipGroup } from '@/lib/enums'
import { initials, paragraphs } from '@/lib/format'

/**
 * Leadership & secretariat — the profile cards promised by §4.3.
 *
 * Two groups on one page rather than two routes: a visitor checking who runs
 * the forum wants the officers and the people who answer the phone in the same
 * glance, and splitting them would leave a route with three cards on it.
 * Governance — the structure rather than the people — has its own page.
 */

export const metadata: Metadata = {
  title: 'Leadership',
  description:
    'The officers and secretariat of the Freetown Business Forum — who leads the forum and who to contact.',
  alternates: { canonical: '/about/leadership' },
}

const GROUPS = [
  {
    group: LeadershipGroup.LEADERSHIP,
    eyebrow: 'Officers',
    title: 'Leadership',
    lead: 'The forum’s elected and appointed officers, accountable to the membership for its direction.',
  },
  {
    group: LeadershipGroup.SECRETARIAT,
    eyebrow: 'Day to day',
    title: 'The secretariat',
    lead: 'The team that runs the forum between editions — membership, the programme, and the answer to most enquiries.',
  },
] as const

export default async function LeadershipPage() {
  const profiles = await db.leadershipProfile.findMany({
    where: {
      isPublished: true,
      group: {
        in: [LeadershipGroup.LEADERSHIP, LeadershipGroup.SECRETARIAT],
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about' },
          { label: 'Leadership', href: '/about/leadership' },
        ]}
      />

      <PageHero
        eyebrow="About"
        title="The people who run the"
        accent="forum"
        lead="FBF is run by its officers and a small secretariat. Their names are here because a forum asking businesses for a subscription should say who is accountable for it."
      />

      {profiles.length === 0 ? (
        <Section tone="white">
          <EmptyState
            title="Profiles are being prepared"
            message="The secretariat’s profiles have not been published yet. In the meantime the contact page reaches the whole team."
          >
            <ButtonLink href="/contact" variant="primary">
              Contact the secretariat
            </ButtonLink>
          </EmptyState>
        </Section>
      ) : (
        GROUPS.map(({ group, eyebrow, title, lead }, index) => {
          const members = profiles.filter((profile) => profile.group === group)
          if (members.length === 0) return null

          return (
            <Section key={group} tone={index % 2 === 0 ? 'white' : 'muted'}>
              <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />

              <CardGrid columns={3} className="mt-10">
                {members.map((profile) => (
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
                        <p className="mt-1 text-sm text-forest-700">
                          {profile.role}
                        </p>
                      </div>
                    </div>

                    {profile.bio && (
                      <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-600">
                        {paragraphs(profile.bio).map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    )}

                    {(profile.email || profile.linkedinUrl) && (
                      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-ink-200 pt-4 text-sm">
                        {profile.email && (
                          <a
                            href={`mailto:${profile.email}`}
                            className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
                          >
                            <Icon name="mail" className="size-4" />
                            Email
                          </a>
                        )}
                        {profile.linkedinUrl && (
                          <a
                            href={profile.linkedinUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
                          >
                            <Icon name="globe" className="size-4" />
                            LinkedIn
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </CardGrid>
            </Section>
          )
        })
      )}

      <CtaBand
        title="How the forum is governed"
        lead="The structure these officers work within — the board, the committees, and how decisions are taken."
        tone="harbour"
      >
        <ButtonLink href="/about/governance" variant="accent" size="lg">
          Governance & structure
        </ButtonLink>
      </CtaBand>
    </>
  )
}
