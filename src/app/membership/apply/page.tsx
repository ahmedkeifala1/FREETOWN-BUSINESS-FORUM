import type { Metadata } from 'next'

import {
  MembershipApplicationForm,
  type ApplicationTier,
} from '@/components/site/membership-application-form'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  EmptyState,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatMoney, isCurrency } from '@/lib/money'
import { getPageCopy } from '@/lib/settings'

/**
 * Apply or renew (SDR §4.10, FR-09).
 *
 * Reached from the tier table with `?tier=<slug>`, which preselects the card
 * rather than hiding the others — somebody who followed "Apply" under Corporate
 * and then reconsiders should not have to go back a page to change their mind.
 *
 * The rail beside the form answers the two questions that stop people starting:
 * what it costs and when they have to pay. Both are answered before the first
 * field, because an applicant who thinks the form ends at a card payment will
 * not begin it.
 */

export const metadata: Metadata = {
  title: 'Apply or renew',
  description:
    'Apply for membership of the Freetown Business Forum — choose a tier, tell us about your organisation, and the secretariat will be in touch within five working days.',
  alternates: { canonical: '/membership/apply' },
}

const STEPS = [
  {
    title: 'You apply',
    body: 'The form here. Nothing is payable at this point, and you get a member number to quote.',
  },
  {
    title: 'The secretariat vets',
    body: 'We check the organisation is trading and reachable — usually within five working days.',
  },
  {
    title: 'You pay',
    body: 'Once approved we invoice the annual fee. Orange Money, Afrimoney, card or bank transfer.',
  },
  {
    title: 'You go live',
    body: 'Your directory entry publishes, the member-only Deal Room opens, and delegate rates apply to the forum.',
  },
]

export default async function MembershipApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>
}) {
  const [{ tier: selectedTierSlug }, user, copy] = await Promise.all([
    searchParams,
    getCurrentUser(),
    // Shares the membership page's copy: the application is a step of that
    // page's journey, not a subject of its own.
    getPageCopy('membership'),
  ])

  const [tierRows, sectors] = await Promise.all([
    db.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        strapline: true,
        priceMinor: true,
        currency: true,
        billingPeriodMonths: true,
      },
    }),
    db.sector.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const tiers: ApplicationTier[] = tierRows.map((tier) => ({
    id: tier.id,
    slug: tier.slug,
    name: tier.name,
    strapline: tier.strapline,
    price: isCurrency(tier.currency)
      ? `${formatMoney(tier.priceMinor, tier.currency, { compact: true })}${
          tier.billingPeriodMonths === 12 ? '/yr' : ''
        }`
      : '—',
  }))

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Membership', href: '/membership' },
          { label: 'Apply or renew', href: '/membership/apply' },
        ]}
      />

      <PageHero
        eyebrow={copy('applyEyebrow', 'Membership')}
        title={copy('applyTitle', 'Apply to')}
        accent={copy('applyAccent', 'join')}
        lead={copy(
          'applyLead',
          'Choose a tier, tell us about your organisation, and the secretariat will come back to you within five working days. Nothing is payable until your application has been approved.',
        )}
      />

      <Section tone="white" size="wide">
        {tiers.length === 0 ? (
          <EmptyState
            title={copy('applyEmptyTitle', 'Applications are closed')}
            message={copy(
              'applyEmptyMessage',
              'Membership tiers are being updated. Please check back shortly, or contact the secretariat and we will let you know when applications reopen.',
            )}
          >
            <ButtonLink href="/contact" variant="outline" size="md">
              Contact the secretariat
            </ButtonLink>
          </EmptyState>
        ) : (
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            {/* ── What happens next ────────────────────────────────────── */}

            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-24">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-forest-700">
                  What happens next
                </h2>

                <ol className="mt-6 space-y-6">
                  {STEPS.map((step, index) => (
                    <li key={step.title} className="flex gap-4">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-50 font-display text-sm font-bold text-forest-700"
                      >
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-display text-base font-semibold text-ink-950">
                          {step.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-ink-600">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-8 flex gap-3 rounded-xl bg-ink-50 p-4">
                  <Icon
                    name="shield"
                    className="mt-0.5 size-5 shrink-0 text-ink-500"
                  />
                  <p className="text-sm leading-relaxed text-ink-600">
                    Your details go to the secretariat. Nothing appears in the
                    business directory until you have seen the entry and told us
                    to publish it.
                  </p>
                </div>
              </div>
            </div>

            {/* ── The form ─────────────────────────────────────────────── */}

            <div className="lg:col-span-8">
              <MembershipApplicationForm
                tiers={tiers}
                sectors={sectors}
                selectedTierSlug={selectedTierSlug}
                signedInEmail={user?.email}
              />
            </div>
          </div>
        )}
      </Section>

      <Section tone="muted">
        <Container size="narrow" className="px-0">
          <h2 className="text-xl text-ink-950">Not sure which tier?</h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            The tier table sets out what each one includes and what it costs,
            side by side. If your organisation sits awkwardly between two of
            them, say so on the form and the secretariat will advise.
          </p>
          <a
            href="/membership/tiers"
            className="mt-4 inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
          >
            Compare tiers &amp; pricing
            <Icon name="arrowRight" className="size-4" />
          </a>
        </Container>
      </Section>
    </>
  )
}
