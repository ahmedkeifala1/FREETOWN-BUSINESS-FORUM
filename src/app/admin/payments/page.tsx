import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import {
  PAYMENT_METHOD_LABELS,
  PaymentStatus,
  type PaymentMethod,
} from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Payments (FR-07, FR-14, §12).
 *
 * Pending first by default, because that is the working list: the rows finance
 * has to match against a bank statement. Paid rows are a record, and a record
 * is looked up rather than scanned, so it is behind a filter.
 *
 * Reconciling happens on the registration or the membership the payment
 * belongs to rather than here. Money is only ever recorded against the thing it
 * bought, so a settled payment and a confirmed registration cannot drift apart.
 */

export const metadata: Metadata = {
  title: 'Payments',
}

const FILTERS = [
  { label: 'Awaiting', value: PaymentStatus.PENDING },
  { label: 'Processing', value: PaymentStatus.PROCESSING },
  { label: 'Received', value: PaymentStatus.PAID },
  { label: 'Failed', value: PaymentStatus.FAILED },
  { label: 'All', value: '' },
]

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission(Permission.PAYMENT_VIEW, {
    redirectTo: '/admin/payments',
  })

  const { status } = await searchParams

  // Default to the working list rather than to everything.
  const active =
    status === undefined
      ? PaymentStatus.PENDING
      : (FILTERS.find((f) => f.value && f.value === status)?.value ?? '')

  const payments = await db.payment.findMany({
    where: active ? { status: active } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      reference: true,
      purpose: true,
      method: true,
      status: true,
      currency: true,
      amountMinor: true,
      paidAt: true,
      createdAt: true,
      payerName: true,
      invoice: { select: { number: true, dueAt: true } },
      registration: { select: { reference: true } },
      member: { select: { memberNo: true, organisationName: true } },
    },
  })

  const total = payments.reduce(
    (sum, payment) =>
      payment.currency === 'SLE' ? sum + payment.amountMinor : sum,
    0,
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Payments
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Record a transfer against the registration or membership it belongs
          to — the link on each row goes straight there.
        </p>
      </header>

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const isCurrent = active === filter.value

            return (
              <li key={filter.label}>
                <Link
                  href={`/admin/payments?status=${filter.value}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium transition-colors',
                    isCurrent
                      ? 'bg-forest-600 text-white'
                      : 'border border-ink-300 bg-white text-ink-700 hover:border-forest-500 hover:text-forest-700',
                  )}
                >
                  {filter.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {payments.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message="No payment currently has that status."
        />
      ) : (
        <>
          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {payments.map((payment) => {
                const href = payment.registration
                  ? `/admin/registrations/${payment.registration.reference}`
                  : payment.member
                    ? `/admin/members/${payment.member.memberNo}`
                    : null

                const body = (
                  <>
                    <div className="min-w-0">
                      <p className="font-medium text-ink-950">
                        {isCurrency(payment.currency)
                          ? formatMoney(payment.amountMinor, payment.currency)
                          : payment.amountMinor}
                        <span className="ml-2 font-normal text-ink-600">
                          {payment.member?.organisationName ??
                            payment.payerName ??
                            ''}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-sm text-ink-600">
                        <span className="font-mono">{payment.reference}</span>
                        {payment.invoice && (
                          <>
                            {' · '}
                            <span className="font-mono">
                              {payment.invoice.number}
                            </span>
                          </>
                        )}
                        {' · '}
                        {PAYMENT_METHOD_LABELS[
                          payment.method as PaymentMethod
                        ] ?? payment.method}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-500">
                        {payment.paidAt
                          ? `Received ${formatDate(payment.paidAt)}`
                          : payment.invoice?.dueAt
                            ? `Due ${formatDate(payment.invoice.dueAt)}`
                            : `Raised ${formatDate(payment.createdAt)}`}
                      </p>
                    </div>

                    <StatusBadge status={payment.status} />
                  </>
                )

                return (
                  <li key={payment.id}>
                    {href ? (
                      <Link
                        href={href}
                        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                        {body}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>

          <p className="text-sm text-ink-600">
            {payments.length} payment{payments.length === 1 ? '' : 's'} shown,
            totalling {formatMoney(total, 'SLE')} in SLE.
          </p>
        </>
      )}
    </div>
  )
}
