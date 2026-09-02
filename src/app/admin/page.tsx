import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import {
  AccessRequestStatus,
  ApplicationStatus,
  MemberStatus,
  PaymentStatus,
  RegistrationStatus,
  SubmissionStatus,
} from '@/lib/enums'
import { formatDate, formatDateRange } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { Permission, requireStaff, userHas } from '@/lib/rbac'
import { getCurrentEvent } from '@/lib/settings'

/**
 * The admin dashboard (§12).
 *
 * A queue, not a report. Every tile is something with a person waiting at the
 * other end of it — an application nobody has read, a payment that has not
 * cleared, an enquiry going stale — and each links straight to the list that
 * clears it. Vanity totals are left to the reporting screens.
 *
 * What is counted depends on what the signed-in role may see, and the counts
 * are only queried when they are going to be shown: an editor's dashboard does
 * not run the finance queries at all.
 */

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function AdminDashboardPage() {
  const user = await requireStaff()

  const canSeeRegistrations = userHas(user, Permission.REGISTRATION_VIEW)
  const canSeeMoney = userHas(user, Permission.PAYMENT_VIEW)
  const canSeeMembers = userHas(user, Permission.MEMBERSHIP_VIEW)
  const canSeeDealRoom = userHas(user, Permission.DEALROOM_VIEW)
  const canSeeSubmissions = userHas(user, Permission.SUBMISSION_VIEW)

  const [
    event,
    pendingMembers,
    newEnquiries,
    newApplications,
    pendingAccess,
    pendingPayments,
    confirmedDelegates,
    revenue,
    recentRegistrations,
  ] = await Promise.all([
    getCurrentEvent(),

    canSeeMembers
      ? db.member.count({ where: { status: MemberStatus.PENDING } })
      : 0,

    canSeeSubmissions
      ? db.formSubmission.count({ where: { status: SubmissionStatus.NEW } })
      : 0,

    canSeeDealRoom
      ? db.fundingApplication.count({
          where: { status: ApplicationStatus.SUBMITTED },
        })
      : 0,

    canSeeDealRoom
      ? db.investorAccessRequest.count({
          where: { status: AccessRequestStatus.PENDING },
        })
      : 0,

    canSeeMoney
      ? db.payment.count({ where: { status: PaymentStatus.PENDING } })
      : 0,

    canSeeRegistrations
      ? db.delegate.count({
          where: {
            registration: { status: RegistrationStatus.CONFIRMED },
          },
        })
      : 0,

    canSeeMoney
      ? db.payment.aggregate({
          where: { status: PaymentStatus.PAID, currency: 'SLE' },
          _sum: { amountMinor: true },
        })
      : null,

    canSeeRegistrations
      ? db.registration.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            reference: true,
            firstName: true,
            lastName: true,
            organisation: true,
            status: true,
            quantity: true,
            createdAt: true,
            ticketType: { select: { name: true } },
          },
        })
      : [],
  ])

  const queue = [
    {
      show: canSeeMembers,
      count: pendingMembers,
      label: 'membership application',
      href: '/admin/members?status=PENDING',
    },
    {
      show: canSeeDealRoom,
      count: newApplications,
      label: 'funding application',
      href: '/admin/deal-room',
    },
    {
      show: canSeeDealRoom,
      count: pendingAccess,
      label: 'investor access request',
      href: '/admin/deal-room?tab=access',
    },
    {
      show: canSeeSubmissions,
      count: newEnquiries,
      label: 'unread enquiry',
      href: '/admin/enquiries',
    },
    {
      show: canSeeMoney,
      count: pendingPayments,
      label: 'payment awaiting settlement',
      href: '/admin/payments?status=PENDING',
    },
  ].filter((item) => item.show && item.count > 0)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Good morning, {user.firstName}
        </h1>
        {event && (
          <p className="mt-2 leading-relaxed text-ink-600">
            {event.name} — {formatDateRange(event.startDate, event.endDate)} at{' '}
            {event.venueName}.
          </p>
        )}
      </header>

      {/* ── The queue ───────────────────────────────────────────────────── */}

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-ink-950">
          Waiting on you
        </h2>

        {queue.length === 0 ? (
          <Card>
            <div className="flex gap-3">
              <Icon
                name="check"
                className="mt-0.5 size-5 shrink-0 text-forest-600"
              />
              <p className="text-sm leading-relaxed text-ink-700">
                Nothing is waiting. Every application, enquiry and payment in
                your remit has been dealt with.
              </p>
            </div>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {queue.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm transition hover:border-forest-400 hover:shadow"
                >
                  <span className="font-display text-3xl font-bold text-forest-700">
                    {item.count}
                  </span>
                  <span className="flex-1 text-sm text-ink-700">
                    {item.label}
                    {item.count === 1 ? '' : 's'} to deal with
                  </span>
                  <Icon
                    name="chevronRight"
                    className="size-5 shrink-0 text-ink-400"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Where things stand ──────────────────────────────────────────── */}

      {(canSeeRegistrations || canSeeMoney) && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink-950">
            Where things stand
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            {canSeeRegistrations && (
              <Card>
                <p className="font-display text-3xl font-bold text-forest-700">
                  {confirmedDelegates}
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  confirmed delegates
                  {event?.expectedDelegates
                    ? ` of ${event.expectedDelegates} expected`
                    : ''}
                </p>
              </Card>
            )}

            {canSeeMoney && revenue && (
              <Card>
                <p className="font-display text-3xl font-bold text-forest-700">
                  {formatMoney(revenue._sum.amountMinor ?? 0, 'SLE', {
                    compact: true,
                  })}
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  collected and cleared (SLE)
                </p>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* ── Latest registrations ────────────────────────────────────────── */}

      {canSeeRegistrations && recentRegistrations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-xl font-semibold text-ink-950">
              Latest registrations
            </h2>
            <Link
              href="/admin/registrations"
              className="text-sm font-medium text-forest-700 hover:underline"
            >
              All registrations
            </Link>
          </div>

          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {recentRegistrations.map((registration) => (
                <li
                  key={registration.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/registrations/${registration.reference}`}
                      className="font-medium text-ink-950 hover:underline"
                    >
                      {registration.firstName} {registration.lastName}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-ink-600">
                      <span className="font-mono">{registration.reference}</span>
                      {' · '}
                      {registration.ticketType.name}
                      {registration.quantity > 1
                        ? ` × ${registration.quantity}`
                        : ''}
                      {' · '}
                      {formatDate(registration.createdAt)}
                    </p>
                  </div>

                  <StatusBadge status={registration.status} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}
