import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { PartnerKind } from '@/lib/enums'
import { initials } from '@/lib/format'

/**
 * Partners & affiliations (SDR §4.3 "partners & affiliations — logo grid").
 *
 * Three groups, in order of how directly they are involved: institutions the
 * forum works with, bodies it belongs to, and organisations that fund or back
 * its work. Grouping matters more than it looks — a visitor who reads a
 * regulator's logo as an endorsement of a sponsor has been misled by the
 * layout, so each group carries a sentence saying what the relationship is.
 *
 * Event sponsors are a different thing and live at /events/sponsors: sponsors
 * pay for one edition, partners are standing relationships.
 */

export const metadata: Metadata = {
  title: 'Partners',
  description:
    'The institutions, affiliations and supporters the Freetown Business Forum works with.',
  alternates: { canonical: '/about/partners' },
}

const GROUPS = [
  {
    kind: PartnerKind.PARTNER,
    eyebrow: 'We work with',
    title: 'Institutional partners',
    lead: 'Government ministries, agencies and institutions the forum works with directly on programmes, policy dialogue and the forum itself.',
  },
  {
    kind: PartnerKind.AFFILIATION,
    eyebrow: 'We belong to',
    title: 'Affiliations',
    lead: 'Bodies the forum is a member of, or is formally associated with, in Sierra Leone and across the region.',
  },
  {
    kind: PartnerKind.SUPPORTER,
    eyebrow: 'Backed by',
    title: 'Supporters',
    lead: 'Organisations that fund or otherwise support the forum’s work. Support does not carry any say in the forum’s positions.',
  },
] as const

export default async function PartnersPage() {
  const partners = await db.partner.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'About', href: '/about' },
          { label: 'Partners', href: '/about/partners' },
        ]}
      />

      <PageHero
        eyebrow="About"
        title="Who the forum works"
        accent="with"
        lead="FBF convenes. That only works if the institutions that decide things are in the room — so the forum’s standing relationships are named here rather than implied by a logo strip."
      />

      {partners.length === 0 ? (
        <Section tone="white">
          <EmptyState
            title="Partners are being confirmed"
            message="Partnerships for the coming edition are being finalised and will be listed here as they are agreed."
          >
            <ButtonLink href="/contact" variant="primary">
              Talk to us about partnering
            </ButtonLink>
          </EmptyState>
        </Section>
      ) : (
        GROUPS.map(({ kind, eyebrow, title, lead }, index) => {
          const group = partners.filter((partner) => partner.kind === kind)
          if (group.length === 0) return null

          return (
            <Section key={kind} tone={index % 2 === 0 ? 'white' : 'muted'}>
              <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />

              <CardGrid columns={3} className="mt-10">
                {group.map((partner) => (
                  <Card key={partner.id} className="flex h-full flex-col">
                    <PartnerMark
                      logoUrl={partner.logoUrl}
                      name={partner.name}
                    />

                    <h3 className="mt-5 font-display text-base font-semibold leading-snug text-ink-950">
                      {partner.name}
                    </h3>

                    {partner.description && (
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                        {partner.description}
                      </p>
                    )}

                    {partner.website && (
                      <a
                        href={partner.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
                      >
                        Visit website
                        <Icon name="arrowRight" className="size-4" />
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}
                  </Card>
                ))}
              </CardGrid>
            </Section>
          )
        })
      )}

      <CtaBand
        title="Partner with the forum"
        lead="Institutions working on enterprise, trade, investment or skills in Sierra Leone — the secretariat would like to hear from you."
      >
        <ButtonLink href="/contact" variant="accent" size="lg">
          Start a conversation
        </ButtonLink>
        <ButtonLink
          href="/events/sponsors"
          size="lg"
          className="border border-white/30 bg-white/10 text-white hover:bg-white/20 active:bg-white/25"
        >
          Sponsor an edition
        </ButtonLink>
      </CtaBand>
    </>
  )
}

/**
 * A partner's logo, or a wordmark standing in for one.
 *
 * Logos arrive from the secretariat at whatever size and aspect the partner
 * supplied, so each sits in a fixed box and is contained rather than cropped —
 * a ministry crest cropped to a square is worse than no crest. `object-contain`
 * on a white field is also what keeps a row of mismatched logos looking like a
 * set (§3.4).
 */
function PartnerMark({
  logoUrl,
  name,
}: {
  logoUrl: string | null
  name: string
}) {
  if (logoUrl) {
    return (
      <div className="flex h-16 items-center">
        {/* CMS logo URLs are arbitrary remote hosts — see the note in ui/card.tsx. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className="max-h-16 w-auto max-w-[70%] object-contain"
        />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-16 w-16 items-center justify-center rounded-lg bg-harbour-50 font-display text-xl font-bold text-harbour-700 ring-1 ring-inset ring-harbour-100"
    >
      {initials(name)}
    </div>
  )
}
