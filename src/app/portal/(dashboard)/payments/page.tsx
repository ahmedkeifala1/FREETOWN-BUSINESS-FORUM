import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { getMyPayments } from '@/lib/portal'
import { requireUser } from '@/lib/rbac'

/**
 * Payments and invoices (§4.16 "invoices/receipts").
 *
 * A table on a wide screen and a stack of cards on a phone — the same rows
 * either way, because a delegate checking a reference against a bank statement
 * on their handset needs the reference, not a horizontally scrolling table
 * (§4.17).
 *
 * Nothing here is actionable: this is a record. Paying for something is done
 * from the registration it belongs to, so there is one place where money moves
 * rather than two that can disagree.
 */

export const metadata: Metadata = {
  title: 'Payments & invoices',
}

const PURPOSE_LABELS: Record<string, string> = {
  EVENT_REGISTRATION: 'Forum registration',
  MEMBERSHIP: 'Membership',
  SPONSORSHIP: 'Sponsorship',
  OTHER: 'Other',
}

export default async function PortalPaymentsPage() {
  const user = await requireUser({ redirectTo: '/portal/payments' })
  const payments = await getMyPayments(user)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Payments &amp; invoices
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Everything you have paid the forum, and anything still outstanding.
          Quote the reference in any correspondence.
        </p>
      </header>

      {payments.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          message="Payments appear here as soon as they are raised — a receipt when they clear, an invoice while they are outstanding."
        />
      ) : (
        <Card padded={false}>
          {/* Wide screens: a real table. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Your payments and invoices, most recent first
              </caption>
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wider text-ink-500">
                  <th scope="col" className="px-6 py-3 font-semibold">
                    Reference
                  </th>
                  <th scope="col" className="px-6 py-3 font-semibold">
                    For
                  </th>
                  <th scope="col" className="px-6 py-3 font-semibold">
                    Method
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-6 py-4">
                      <span className="font-mono text-ink-900">
                        {payment.reference}
                      </span>
                      {payment.invoice && (
                        <span className="mt-0.5 block font-mono text-xs text-ink-500">
                          {payment.invoice.number}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-ink-700">
                      {PURPOSE_LABELS[payment.purpose] ?? payment.purpose}
                      {payment.registration && (
                        <span className="mt-0.5 block text-xs text-ink-500">
                          {payment.registration.event.name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-ink-700">
                      {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ??
                        payment.method}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-ink-950">
                      {isCurrency(payment.currency)
                        ? formatMoney(payment.amountMinor, payment.currency)
                        : payment.amountMinor}
                    </td>
                    <td className="px-6 py-4 text-ink-700">
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={payment.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: the same rows, stacked (§4.17). */}
          <ul className="divide-y divide-ink-100 sm:hidden">
            {payments.map((payment) => (
              <li key={payment.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display font-semibold text-ink-950">
                    {isCurrency(payment.currency)
                      ? formatMoney(payment.amountMinor, payment.currency)
                      : payment.amountMinor}
                  </p>
                  <StatusBadge status={payment.status} />
                </div>

                <dl className="mt-2 space-y-1 text-sm text-ink-600">
                  <div className="flex gap-2">
                    <dt className="sr-only">Reference</dt>
                    <dd className="font-mono">{payment.reference}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="sr-only">For</dt>
                    <dd>
                      {PURPOSE_LABELS[payment.purpose] ?? payment.purpose}
                      {' · '}
                      {PAYMENT_METHOD_LABELS[
                        payment.method as PaymentMethod
                      ] ?? payment.method}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="sr-only">Date</dt>
                    <dd>{formatDate(payment.paidAt ?? payment.createdAt)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-sm text-ink-600">
        Need a formal receipt or a copy of an invoice for your accounts? Email
        the secretariat with the reference and we will send one.
      </p>
    </div>
  )
}
