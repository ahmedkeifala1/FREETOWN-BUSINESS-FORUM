import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { OrderSummary } from '@/components/site/order-summary'
import { PaymentMethodForm } from '@/components/site/payment-method-form'
import { RegisterSteps } from '@/components/site/register-steps'
import { Icon } from '@/components/ui/icon'
import { Breadcrumbs, Section } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { PaymentStatus, RegistrationStatus } from '@/lib/enums'
import { formatDateRange } from '@/lib/format'
import { isCurrency, type Currency } from '@/lib/money'
import { isSandboxMode, listGateways } from '@/lib/payments/gateways'

/**
 * Register — step 3, payment (§4.9, FR-07).
 *
 * The registration reference in the URL is the capability that grants access
 * to this page. It is random, not sequential (see lib/reference.ts), and the
 * page carries nothing an attacker guessing one would find useful that they
 * did not already have to know — a name and an amount owed. Requiring an
 * account here would contradict the flow's own promise that registering needs
 * none, and would lock out the delegate who registered on a colleague's phone.
 */

export const metadata: Metadata = {
  title: 'Payment',
  description: 'Step 3 of registering for the Freetown Business Forum.',
  robots: { index: false, follow: false },
}

type Params = { reference: string }

export default async function PayPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { reference } = await params

  const registration = await db.registration.findUnique({
    where: { reference },
    include: {
      event: true,
      ticketType: { select: { name: true } },
      payment: true,
    },
  })

  if (!registration) notFound()

  // Already paid, or cancelled — the status page is the right place for both.
  if (
    registration.status !== RegistrationStatus.PENDING ||
    registration.payment?.status === PaymentStatus.PAID
  ) {
    redirect(`/register/${reference}`)
  }

  const currency: Currency = isCurrency(registration.currency)
    ? registration.currency
    : 'SLE'

  const methods = listGateways().map((gateway) => ({
    method: gateway.method,
    displayName: gateway.displayName,
    blurb: gateway.blurb,
    requiresPhone: gateway.requiresPhone,
  }))

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Register', href: '/register' },
          { label: 'Payment', href: `/register/${reference}/pay` },
        ]}
      />
      <RegisterSteps current={3} />

      <Section tone="white" size="wide" className="py-8 sm:py-10">
        <h1 className="text-3xl text-ink-950 sm:text-4xl">Payment</h1>
        <p className="mt-3 text-ink-600">
          {registration.event.name} ·{' '}
          {formatDateRange(
            registration.event.startDate,
            registration.event.endDate,
          )}
        </p>
        <p className="mt-1 text-sm text-ink-500">
          Registration reference{' '}
          <span className="font-medium text-ink-900">{reference}</span>
        </p>
      </Section>

      {isSandboxMode() && (
        <Section tone="white" size="wide" className="py-0">
          <div className="flex gap-3 rounded-xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
            <Icon
              name="shield"
              className="mt-0.5 size-5 shrink-0 text-amber-800"
            />
            <p className="text-sm leading-relaxed text-amber-900">
              <strong>Sandbox mode.</strong> No money moves. Each method
              simulates the full authorise → confirm cycle locally so the flow
              can be walked end to end before FBF’s merchant accounts are
              provisioned.
            </p>
          </div>
        </Section>
      )}

      <Section tone="white" size="wide" className="pt-8 sm:pt-10">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <PaymentMethodForm
              reference={reference}
              methods={methods}
              defaultPhone={registration.phone}
            />
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <OrderSummary
                title="Amount due"
                ticketName={registration.ticketType.name}
                quantity={registration.quantity}
                currency={currency}
                subtotalMinor={registration.subtotalMinor}
                discounts={
                  registration.discountMinor > 0
                    ? [
                        {
                          kind: 'PROMO',
                          label: 'Discounts applied',
                          amountMinor: registration.discountMinor,
                        },
                      ]
                    : []
                }
                totalMinor={registration.totalMinor}
              >
                <div className="space-y-3 border-t border-ink-200 pt-5 text-sm">
                  <p className="text-ink-600">
                    Registered to{' '}
                    <span className="font-medium text-ink-900">
                      {registration.firstName} {registration.lastName}
                    </span>
                    , {registration.email}
                  </p>

                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
                  >
                    <Icon name="arrowRight" className="size-4 rotate-180" />
                    Start again
                  </Link>
                </div>
              </OrderSummary>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
