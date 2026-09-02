import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { MemberStatus } from '@/lib/enums'
import { daysUntil, formatDate, parseJsonColumn } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { getMyMembership } from '@/lib/portal'
import { requireUser } from '@/lib/rbac'

/**
 * My membership (§4.16 "membership status & renewal").
 *
 * The page leads with the one thing that changes what a member should do —
 * whether the membership is active, pending or lapsed — and the renewal prompt
 * only appears when there is something to renew. A permanent "renew now"
 * button on a membership with eight months left is noise that trains people to
 * ignore it in the month it matters.
 */

export const metadata: Metadata = {
  title: 'My membership',
}

/** Renewal is offered inside this window, and once expired. */
const RENEWAL_WINDOW_DAYS = 60

export default async function PortalMembershipPage() {
  const user = await requireUser({ redirectTo: '/portal/membership' })

  if (!user.memberId) redirect('/membership')

  const membership = await getMyMembership(user)

  if (!membership) redirect('/portal')

  const features = parseJsonColumn<string[]>(membership.tier.featuresJson, [])

  const daysLeft = membership.expiresAt
    ? daysUntil(membership.expiresAt)
    : null

  const expired =
    membership.status === MemberStatus.EXPIRED ||
    (daysLeft !== null && daysLeft < 0)

  const dueSoon =
    !expired &&
    membership.status === MemberStatus.ACTIVE &&
    daysLeft !== null &&
    daysLeft <= RENEWAL_WINDOW_DAYS

  const fee = isCurrency(membership.tier.currency)
    ? formatMoney(membership.tier.priceMinor, membership.tier.currency)
    : String(membership.tier.priceMinor)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          My membership
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Your tier, your status and what it includes.
        </p>
      </header>

      {/* ── The card ────────────────────────────────────────────────────── */}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
              {membership.tier.name}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink-950">
              {membership.organisationName}
            </h2>
            <p className="mt-2 font-mono text-sm text-ink-700">
              {membership.memberNo}
            </p>
          </div>

          <StatusBadge status={membership.status} />
        </div>

        <dl className="mt-6 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Joined
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {membership.joinedAt ? formatDate(membership.joinedAt) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              {expired ? 'Expired' : 'Renews'}
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {membership.expiresAt ? formatDate(membership.expiresAt) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Annual fee
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">{fee}</dd>
          </div>
        </dl>
      </Card>

      {/* ── What to do next, if anything ────────────────────────────────── */}

      {membership.status === MemberStatus.PENDING && (
        <Card className="border-harbour-200 bg-harbour-50">
          <div className="flex gap-3">
            <Icon
              name="clock"
              className="mt-0.5 size-5 shrink-0 text-harbour-700"
            />
            <div>
              <h2 className="font-display font-semibold text-ink-950">
                With the secretariat
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">
                We are checking your application — usually within five working
                days of it arriving. You will get an email with the invoice for
                your first year as soon as it is approved. Nothing is payable
                until then, and there is nothing else you need to do.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                In the meantime you can write your directory entry, ready to go
                live the moment the membership does.
              </p>
              <div className="mt-4">
                <ButtonLink href="/portal/listing" variant="outline" size="md">
                  Write my directory entry
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      )}

      {(expired || dueSoon) && (
        <Card
          className={
            expired
              ? 'border-red-200 bg-red-50'
              : 'border-amber-300 bg-amber-50'
          }
        >
          <div className="flex gap-3">
            <Icon
              name="clock"
              className={`mt-0.5 size-5 shrink-0 ${
                expired ? 'text-red-700' : 'text-amber-700'
              }`}
            />
            <div>
              <h2 className="font-display font-semibold text-ink-950">
                {expired
                  ? 'Your membership has lapsed'
                  : `Renewal due in ${daysLeft} days`}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">
                {expired
                  ? 'Your directory entry is hidden and member rates no longer apply. Renewing restores both — your member number and your listing are kept.'
                  : 'Renew before it expires and your directory entry and member rates carry on without a gap.'}
              </p>
              <div className="mt-4">
                <ButtonLink href="/contact" size="md">
                  Renew my membership
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── What it includes ────────────────────────────────────────────── */}

      {features.length > 0 && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            What {membership.tier.name} includes
          </h2>
          {membership.tier.strapline && (
            <p className="mt-1 text-sm text-ink-600">
              {membership.tier.strapline}
            </p>
          )}

          <ul className="mt-5 space-y-2.5">
            {features.map((feature) => (
              <li key={feature} className="flex gap-2.5 text-sm text-ink-700">
                <Icon
                  name="check"
                  className="mt-0.5 size-4 shrink-0 text-forest-600"
                />
                {feature}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-ink-100 pt-5">
            <ButtonLink href="/membership/tiers" variant="outline" size="md">
              Compare tiers
            </ButtonLink>
            <ButtonLink href="/deal-room" variant="ghost" size="md">
              Deal Room
            </ButtonLink>
          </div>
        </Card>
      )}
    </div>
  )
}
