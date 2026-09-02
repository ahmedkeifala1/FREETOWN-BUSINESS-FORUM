import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ReconcilePaymentForm } from '@/components/site/reconcile-payment-form'
import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import {
  PAYMENT_METHOD_LABELS,
  PaymentStatus,
  type PaymentMethod,
} from '@/lib/enums'
import { formatDate, formatDateRange } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { Permission, requirePermission, userHas } from '@/lib/rbac'

/**
 * One registration (§4.9, §12).
 *
 * The delegate list carries the ticket codes, because the commonest job on
 * this screen is reading a code down the phone to someone who has lost their
 * email — which is also why the codes are set in a monospace face large enough
 * to dictate without misreading an O for a 0.
 *
 * Reconciling the payment appears only for finance, and only while there is
 * something to reconcile.
 */

export const metadata: Metadata = {
  title: 'Registration',
}

export default async function AdminRegistrationPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const user = await requirePermission(Permission.REGISTRATION_VIEW, {
    redirectTo: '/admin/registrations',
  })

  const { reference } = await params

  const registration = await db.registration.findUnique({
    where: { reference: decodeURIComponent(reference).toUpperCase() },
    select: {
      id: true,
      reference: true,
      status: true,
      quantity: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      organisation: true,
      jobTitle: true,
      country: true,
      dietary: true,
      accessibility: true,
      isGroup: true,
      groupName: true,
      currency: true,
      subtotalMinor: true,
      discountMinor: true,
      totalMinor: true,
      createdAt: true,
      confirmedAt: true,
      event: {
        select: {
          name: true,
          startDate: true,
          endDate: true,
          venueName: true,
        },
      },
      ticketType: { select: { name: true } },
      promoCode: { select: { code: true } },
      payment: {
        select: {
          id: true,
          reference: true,
          status: true,
          method: true,
          provider: true,
          providerRef: true,
          amountMinor: true,
          currency: true,
          paidAt: true,
          failureReason: true,
          invoice: { select: { number: true, status: true, dueAt: true } },
        },
      },
      delegates: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          organisation: true,
          jobTitle: true,
          ticketCode: true,
          checkedInAt: true,
        },
      },
    },
  })

  if (!registration) notFound()

  const money = (minor: number) =>
    isCurrency(registration.currency)
      ? formatMoney(minor, registration.currency)
      : String(minor)

  const payment = registration.payment

  const canReconcile =
    userHas(user, Permission.PAYMENT_MANAGE) &&
    payment &&
    payment.status !== PaymentStatus.PAID

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/registrations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          All registrations
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {registration.firstName} {registration.lastName}
          </h1>
          <p className="mt-2 font-mono text-sm text-ink-700">
            {registration.reference}
          </p>
          <p className="mt-1 text-sm text-ink-600">
            {registration.event.name} —{' '}
            {formatDateRange(
              registration.event.startDate,
              registration.event.endDate,
            )}
          </p>
        </div>

        <StatusBadge status={registration.status} />
      </header>

      {/* ── Booking ─────────────────────────────────────────────────────── */}

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Booking
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Ticket
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {registration.ticketType.name} × {registration.quantity}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Booked
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {formatDate(registration.createdAt)}
            </dd>
          </div>
          {registration.isGroup && registration.groupName && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Group
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {registration.groupName}
              </dd>
            </div>
          )}
          {registration.confirmedAt && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Confirmed
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {formatDate(registration.confirmedAt)}
              </dd>
            </div>
          )}
        </dl>

        <dl className="mt-5 space-y-1.5 border-t border-ink-100 pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-600">Subtotal</dt>
            <dd className="text-ink-900">
              {money(registration.subtotalMinor)}
            </dd>
          </div>
          {registration.discountMinor > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-600">
                Discount
                {registration.promoCode && ` (${registration.promoCode.code})`}
              </dt>
              <dd className="text-forest-700">
                −{money(registration.discountMinor)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-ink-100 pt-1.5 font-semibold">
            <dt className="text-ink-950">Total</dt>
            <dd className="text-ink-950">{money(registration.totalMinor)}</dd>
          </div>
        </dl>
      </Card>

      {/* ── Lead delegate ───────────────────────────────────────────────── */}

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Billing contact
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Email
            </dt>
            <dd className="mt-0.5 text-sm">
              <a
                href={`mailto:${registration.email}`}
                className="text-forest-700 hover:underline"
              >
                {registration.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Phone
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {registration.phone}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Organisation
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {registration.organisation ?? '—'}
              {registration.jobTitle && (
                <span className="block text-ink-600">
                  {registration.jobTitle}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Country
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {registration.country}
            </dd>
          </div>
        </dl>

        {(registration.dietary || registration.accessibility) && (
          <dl className="mt-5 space-y-4 border-t border-ink-100 pt-5">
            {registration.dietary && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">
                  Dietary
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {registration.dietary}
                </dd>
              </div>
            )}
            {registration.accessibility && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">
                  Accessibility
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {registration.accessibility}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Card>

      {/* ── Delegates ───────────────────────────────────────────────────── */}

      {registration.delegates.length > 0 && (
        <Card padded={false}>
          <h2 className="px-5 pt-5 font-display text-lg font-semibold text-ink-950 sm:px-6 sm:pt-6">
            Delegates
          </h2>

          <ul className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
            {registration.delegates.map((delegate) => (
              <li
                key={delegate.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink-950">
                    {delegate.firstName} {delegate.lastName}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-600">
                    {delegate.email}
                    {delegate.organisation && ` · ${delegate.organisation}`}
                  </p>
                  <p className="mt-1 font-mono text-base tracking-wide text-ink-900">
                    {delegate.ticketCode}
                  </p>
                </div>

                {delegate.checkedInAt ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                    <Icon name="check" className="size-4" />
                    Admitted {formatDate(delegate.checkedInAt)}
                  </span>
                ) : (
                  <span className="text-sm text-ink-500">Not yet arrived</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Payment ─────────────────────────────────────────────────────── */}

      {userHas(user, Permission.PAYMENT_VIEW) && payment && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-ink-950">
              Payment
            </h2>
            <StatusBadge status={payment.status} />
          </div>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Reference
              </dt>
              <dd className="mt-0.5 font-mono text-sm text-ink-900">
                {payment.reference}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Method
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ??
                  payment.method}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Amount
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {isCurrency(payment.currency)
                  ? formatMoney(payment.amountMinor, payment.currency)
                  : payment.amountMinor}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                {payment.paidAt ? 'Paid' : 'Status'}
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {payment.paidAt
                  ? formatDate(payment.paidAt)
                  : (payment.failureReason ?? 'Awaiting settlement')}
              </dd>
            </div>
            {payment.invoice && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">
                  Invoice
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-ink-900">
                  {payment.invoice.number}
                  {payment.invoice.dueAt && (
                    <span className="block font-sans text-ink-600">
                      due {formatDate(payment.invoice.dueAt)}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {payment.providerRef && (
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">
                  Provider reference
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-ink-900">
                  {payment.providerRef}
                </dd>
              </div>
            )}
          </dl>

          {canReconcile && (
            <div className="mt-6 border-t border-ink-100 pt-6">
              <h3 className="font-display font-semibold text-ink-950">
                Reconcile
              </h3>
              <div className="mt-4">
                <ReconcilePaymentForm
                  paymentId={payment.id}
                  reference={payment.reference}
                  amount={
                    isCurrency(payment.currency)
                      ? formatMoney(payment.amountMinor, payment.currency)
                      : String(payment.amountMinor)
                  }
                />
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
