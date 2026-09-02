import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { EmptyState } from '@/components/ui/layout'
import { requireUser } from '@/lib/rbac'
import { formatDate, formatDateRange, daysUntil } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import {
  getMyFundingApplications,
  getMyMembership,
  getMyPayments,
  getMyRegistrations,
} from '@/lib/portal'
import { MemberStatus, RegistrationStatus } from '@/lib/enums'

/**
 * The portal dashboard (§4.16).
 *
 * One screen that answers "what do I have with the forum?" — and nothing else.
 * The detail lives in the sections; this page is a set of doors with enough on
 * each to know whether it needs opening.
 *
 * What appears is driven by what the person actually has rather than by their
 * role name. A delegate who later joins sees membership cards appear in the
 * same place; nobody is shown an empty "your membership" panel explaining that
 * they have no membership.
 */

export const metadata: Metadata = {
  title: 'Dashboard',
}

function money(minor: number, currency: string): string {
  return isCurrency(currency) ? formatMoney(minor, currency) : String(minor)
}

export default async function PortalDashboardPage() {
  const user = await requireUser({ redirectTo: '/portal' })

  const [registrations, membership, payments, applications] = await Promise.all([
    getMyRegistrations(user),
    getMyMembership(user),
    getMyPayments(user),
    getMyFundingApplications(user),
  ])

  const now = new Date()

  const upcoming = registrations
    .filter(
      (r) =>
        r.status !== RegistrationStatus.CANCELLED && r.event.endDate >= now,
    )
    .sort((a, b) => a.event.startDate.getTime() - b.event.startDate.getTime())

  const nextUp = upcoming[0]

  const ticketCount = upcoming.reduce((sum, r) => sum + r.delegates.length, 0)

  const outstanding = payments.filter(
    (p) => p.status === 'PENDING' || p.invoice?.status === 'OVERDUE',
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Good to see you, {user.firstName}
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Everything you have with the Freetown Business Forum, in one place.
        </p>
      </header>

      {/* ── Anything needing attention ──────────────────────────────────── */}

      {outstanding.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <div className="flex gap-3">
            <Icon
              name="clock"
              className="mt-0.5 size-5 shrink-0 text-amber-700"
            />
            <div>
              <h2 className="font-display font-semibold text-ink-950">
                {outstanding.length === 1
                  ? 'One payment is outstanding'
                  : `${outstanding.length} payments are outstanding`}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">
                A place is only held once payment clears. If you have already
                paid by bank transfer it can take a day or two to show here.
              </p>
              <Link
                href="/portal/payments"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
              >
                See what is owing
                <Icon name="arrowRight" className="size-4" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ── The forum ───────────────────────────────────────────────────── */}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink-950">
          The forum
        </h2>

        {nextUp ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                  {daysUntil(nextUp.event.startDate) > 0
                    ? `In ${daysUntil(nextUp.event.startDate)} days`
                    : 'Happening now'}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-ink-950">
                  {nextUp.event.name}
                </h3>
                <p className="mt-1 text-sm text-ink-600">
                  {formatDateRange(nextUp.event.startDate, nextUp.event.endDate)}
                  {' · '}
                  {nextUp.event.venueName}, {nextUp.event.city}
                </p>
              </div>

              <StatusBadge status={nextUp.status} />
            </div>

            <dl className="mt-5 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">
                  Reference
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-ink-900">
                  {nextUp.reference}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">
                  Ticket
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {nextUp.ticketType.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">
                  Delegates
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {nextUp.delegates.length || nextUp.quantity}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/portal/tickets" size="md">
                {ticketCount === 1 ? 'View my e-ticket' : 'View my e-tickets'}
              </ButtonLink>
              <ButtonLink href="/events/agenda" variant="outline" size="md">
                Agenda
              </ButtonLink>
              <ButtonLink href="/events/venue" variant="ghost" size="md">
                Venue &amp; travel
              </ButtonLink>
            </div>
          </Card>
        ) : (
          <EmptyState
            title="No upcoming registration"
            message="You are not booked on to a forum yet. Registration takes a few minutes and your e-ticket is issued straight away."
          >
            <ButtonLink href="/register" size="md">
              Register for the forum
            </ButtonLink>
          </EmptyState>
        )}
      </section>

      {/* ── Membership ──────────────────────────────────────────────────── */}

      {membership && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink-950">
            Membership
          </h2>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-ink-950">
                  {membership.tier.name}
                </h3>
                <p className="mt-1 text-sm text-ink-600">
                  {membership.organisationName}
                </p>
                <p className="mt-1 font-mono text-sm text-ink-700">
                  {membership.memberNo}
                </p>
              </div>

              <StatusBadge status={membership.status} />
            </div>

            {membership.status === MemberStatus.PENDING && (
              <p className="mt-4 rounded-lg bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
                Your application is with the secretariat. We will email you when
                it has been reviewed — usually within five working days — along
                with the invoice for your first year.
              </p>
            )}

            {membership.expiresAt && (
              <p className="mt-4 text-sm text-ink-600">
                {membership.expiresAt < now
                  ? `Expired on ${formatDate(membership.expiresAt)}.`
                  : `Runs until ${formatDate(membership.expiresAt)}.`}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/portal/membership" variant="outline" size="md">
                Membership details
              </ButtonLink>
              <ButtonLink href="/portal/listing" variant="ghost" size="md">
                {membership.listing?.isPublished
                  ? 'Edit directory listing'
                  : 'Publish directory listing'}
              </ButtonLink>
            </div>
          </Card>
        </section>
      )}

      {/* ── Deal Room ───────────────────────────────────────────────────── */}

      {applications.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink-950">
            Deal Room
          </h2>

          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {applications.map((application) => (
                <li
                  key={application.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <div>
                    <p className="font-medium text-ink-950">
                      {application.businessName}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-600">
                      <span className="font-mono">{application.reference}</span>
                      {' · '}
                      {money(
                        application.amountRequestedMinor,
                        application.currency,
                      )}
                      {' · '}
                      submitted {formatDate(application.createdAt)}
                    </p>
                  </div>

                  <StatusBadge status={application.status} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* ── Money ───────────────────────────────────────────────────────── */}

      {payments.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink-950">
              Recent payments
            </h2>
            <Link
              href="/portal/payments"
              className="text-sm font-medium text-forest-700 hover:underline"
            >
              All payments &amp; invoices
            </Link>
          </div>

          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {payments.slice(0, 4).map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <div>
                    <p className="font-medium text-ink-950">
                      {money(payment.amountMinor, payment.currency)}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-600">
                      <span className="font-mono">{payment.reference}</span>
                      {' · '}
                      {payment.paidAt
                        ? `paid ${formatDate(payment.paidAt)}`
                        : `raised ${formatDate(payment.createdAt)}`}
                    </p>
                  </div>

                  <StatusBadge status={payment.status} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}
