import Link from 'next/link'
import type { Metadata } from 'next'

import { Faq, type FaqItem } from '@/components/site/faq'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  CtaBand,
  EmptyState,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import { parseJsonColumn } from '@/lib/format'
import { formatMoney, isCurrency, type Currency } from '@/lib/money'
import { getCurrentEvent, getPageBlocks } from '@/lib/settings'

/**
 * Membership tiers & pricing (SDR §4.10 "tier comparison table with pricing
 * and features").
 *
 * The comparison is done as a column per tier rather than a matrix of ticks.
 * The tiers do not offer the same feature at four grades — an Individual
 * listing and a Corporate profile are different objects — so a shared-row
 * matrix would have to paraphrase each tier's benefits into a common wording
 * that matches none of them. Columns let each tier say what it actually
 * includes, and on a phone they stack into four readable cards (§4.17).
 *
 * Prices are shown in SLE with the USD figure alongside where the tier carries
 * one (NFR-11). Both come from the row in minor units — no arithmetic happens
 * here beyond dividing the annual price into a monthly equivalent, and that is
 * done in minor units too.
 */

export const metadata: Metadata = {
  title: 'Tiers & pricing',
  description:
    'Freetown Business Forum membership tiers — Individual, SME, Corporate and Patron — with what each includes and what it costs.',
  alternates: { canonical: '/membership/tiers' },
}

/**
 * The tier the page steers an undecided visitor towards.
 *
 * SME rather than the cheapest or the dearest: it is the tier the forum's
 * mandate names first (§4.3 "promoting small and medium enterprises") and the
 * one whose benefits list is the shape most enquiries describe.
 */
const RECOMMENDED_SLUG = 'sme'

export default async function TiersPage() {
  const [tiers, blocks, event] = await Promise.all([
    db.membershipTier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    getPageBlocks('membership'),
    getCurrentEvent(),
  ])

  const faqs = parseJsonColumn<FaqItem[]>(blocks.faq ?? null, [])

  // The saving a member makes on one registration — the most concrete number
  // on the page, so it is fetched rather than asserted.
  const rates = event
    ? await db.ticketType.findMany({
        where: {
          eventId: event.id,
          isActive: true,
          slug: { in: ['standard', 'member'] },
        },
        select: { slug: true, priceMinor: true, currency: true },
      })
    : []

  const standard = rates.find((rate) => rate.slug === 'standard')
  const member = rates.find((rate) => rate.slug === 'member')
  const saving =
    standard && member && standard.currency === member.currency
      ? standard.priceMinor - member.priceMinor
      : null

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Membership', href: '/membership' },
          { label: 'Tiers & pricing', href: '/membership/tiers' },
        ]}
      />

      <PageHero
        eyebrow="Membership"
        title="Four tiers, one"
        accent="membership"
        lead="Every tier carries a directory listing, the member rate on forum registration and the monthly briefing. What changes is how much of the forum's machinery works on your behalf."
      >
        <ButtonLink
          href="/membership/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Apply for membership
          <Icon name="arrowRight" className="size-5" />
        </ButtonLink>
      </PageHero>

      {tiers.length === 0 ? (
        <Section tone="white">
          <EmptyState
            title="Tiers are being set"
            message="Membership rates for the coming year are being confirmed. Register your interest and you will be told as soon as they are published."
          >
            <ButtonLink href="/contact" variant="primary">
              Register your interest
            </ButtonLink>
          </EmptyState>
        </Section>
      ) : (
        <Section tone="white" size="wide">
          {/*
            One <ul> that becomes a four-column grid. The columns are equal
            height so the "Apply" buttons line up across the row — a price
            comparison where the buttons sit at four different heights is
            noticeably harder to scan.
          */}
          <ul className="grid gap-6 lg:grid-cols-4 lg:gap-5">
            {tiers.map((tier) => (
              <TierColumn
                key={tier.id}
                tier={tier}
                recommended={tier.slug === RECOMMENDED_SLUG}
              />
            ))}
          </ul>

          <div className="mt-10 space-y-2 text-sm text-ink-600">
            <p>
              All rates are per year and include VAT where it applies.
              Membership runs for twelve months from the date it is approved,
              not from the start of the calendar year.
            </p>
            <p>
              Rates are charged in Leones. The US dollar figure is shown for
              guidance and is converted at the rate held on the tier — an
              international member is billed the dollar amount shown.
            </p>
          </div>
        </Section>
      )}

      {/* ── The registration saving ──────────────────────────────────────── */}

      {saving !== null && saving > 0 && standard && (
        <Section tone="forest" size="wide">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-14">
            <div className="lg:col-span-7">
              <SectionHeading
                eyebrow="The arithmetic"
                title="Membership pays for part of itself"
                lead="Members register for the forum at the member rate. On the current edition that is the difference below, per delegate, before anything else membership carries."
                inverted
              />
            </div>

            <div className="lg:col-span-5">
              <div className="border-t-2 border-gold-400 pt-6">
                <p className="font-display text-4xl font-bold text-gold-300 sm:text-5xl">
                  {formatMoney(
                    saving,
                    isCurrency(standard.currency) ? standard.currency : 'SLE',
                    { compact: true },
                  )}
                </p>
                <p className="mt-2 text-white/75">
                  saved on every forum registration
                </p>
                <Link
                  href="/register"
                  className="mt-4 inline-flex items-center gap-1.5 font-medium text-gold-300 hover:underline"
                >
                  See the ticket rates
                  <Icon name="arrowRight" className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── How paying works ─────────────────────────────────────────────── */}

      <Section tone="muted" size="wide">
        <SectionHeading
          eyebrow="Paying"
          title="How subscriptions are paid"
          lead="The same methods as forum registration, including the two that most Sierra Leonean businesses actually use."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <PayMethod
            icon="smartphone"
            title="Orange Money"
            body="Approve the prompt on your handset. The membership activates as soon as the confirmation reaches us."
          />
          <PayMethod
            icon="smartphone"
            title="Afrimoney"
            body="The same flow as Orange Money, on an Afrimoney wallet."
          />
          <PayMethod
            icon="ticket"
            title="Card"
            body="Handled on our payment provider’s hosted page. No card details ever reach this site."
          />
          <PayMethod
            icon="document"
            title="Invoice"
            body="For organisations that pay by bank transfer. An invoice is issued and the membership activates on receipt."
          />
        </div>
      </Section>

      {faqs.length > 0 && (
        <Section tone="white">
          <Container size="narrow" className="px-0">
            <SectionHeading
              eyebrow="Before you apply"
              title="Questions we are asked"
            />
            <div className="mt-8">
              <Faq items={faqs} />
            </div>
          </Container>
        </Section>
      )}

      <CtaBand
        title="Pick a tier and apply"
        lead="The application takes a few minutes. Nothing is charged until the secretariat has approved it."
      >
        <ButtonLink
          href="/membership/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Apply for membership
        </ButtonLink>
        <ButtonLink
          href="/contact"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Ask a question first
        </ButtonLink>
      </CtaBand>
    </>
  )
}

type Tier = {
  id: string
  slug: string
  name: string
  strapline: string | null
  priceMinor: number
  currency: string
  priceMinorUSD: number | null
  billingPeriodMonths: number
  featuresJson: string
}

function TierColumn({
  tier,
  recommended,
}: {
  tier: Tier
  recommended: boolean
}) {
  const features = parseJsonColumn<string[]>(tier.featuresJson, [])
  const currency: Currency = isCurrency(tier.currency) ? tier.currency : 'SLE'

  // Integer division in minor units — see the money convention in the README:
  // no float ever touches a price, including a derived one.
  const monthly =
    tier.billingPeriodMonths > 0
      ? Math.round(tier.priceMinor / tier.billingPeriodMonths)
      : null

  return (
    <li
      className={cn(
        'flex flex-col border bg-white p-6',
        recommended
          ? 'border-forest-600 shadow-lg ring-1 ring-forest-600'
          : 'border-ink-200 shadow-sm',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink-950">
          {tier.name}
        </h2>
        {recommended && <Badge tone="forest">Most chosen</Badge>}
      </div>

      {tier.strapline && (
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          {tier.strapline}
        </p>
      )}

      <div className="mt-6 border-t border-ink-200 pt-6">
        <p className="font-display text-3xl font-bold text-ink-950">
          {formatMoney(tier.priceMinor, currency, { compact: true })}
        </p>
        <p className="mt-1 text-sm text-ink-600">
          per year
          {tier.billingPeriodMonths !== 12 &&
            ` (${tier.billingPeriodMonths} months)`}
        </p>

        {tier.priceMinorUSD !== null && (
          <p className="mt-2 text-sm text-ink-600">
            or {formatMoney(tier.priceMinorUSD, 'USD', { compact: true })} for
            international members
          </p>
        )}

        {monthly !== null && (
          <p className="mt-2 text-xs text-ink-500">
            about {formatMoney(monthly, currency, { compact: true })} a month
          </p>
        )}
      </div>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-500">
        Includes
      </h3>

      <ul className="mt-3 flex-1 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex gap-2.5 text-sm text-ink-700">
            <Icon
              name="check"
              className="mt-0.5 size-4 shrink-0 text-forest-600"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <ButtonLink
        href={`/membership/apply?tier=${tier.slug}`}
        variant={recommended ? 'accent' : 'outline'}
        fullWidth
        className="mt-8 rounded-none font-semibold uppercase tracking-wider"
      >
        Apply
        <span className="sr-only"> for {tier.name} membership</span>
      </ButtonLink>
    </li>
  )
}

function PayMethod({
  icon,
  title,
  body,
}: {
  icon: string
  title: string
  body: string
}) {
  return (
    <div className="border-t-2 border-ink-950 pt-5">
      <Icon name={icon} className="size-6 text-forest-600" />
      <h3 className="mt-3 font-display text-base font-semibold text-ink-950">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
    </div>
  )
}
