import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Container } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { formatMoney, isCurrency, type Currency } from '@/lib/money'
import { isSandboxMode } from '@/lib/payments/gateways'
import { sandboxApprove, sandboxDecline } from '@/lib/actions/sandbox'

/**
 * The stand-in for the card provider's hosted page (§4.9 step 3, NFR-06).
 *
 * The card driver redirects here in sandbox mode so the whole flow —
 * redirect out, pay, come back, ticket issued — can be walked without a PSP
 * account. It is deliberately styled as a *different* site: a delegate leaving
 * FBF for a payment page should be able to see that they have left, and a
 * developer should never mistake this for the real thing.
 *
 * Returns 404 in live mode, so the route does not exist in production.
 */

export const metadata: Metadata = {
  title: 'Secure checkout',
  robots: { index: false, follow: false },
}

export default async function SandboxCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  if (!isSandboxMode()) notFound()

  const { ref } = await searchParams
  if (!ref) notFound()

  const payment = await db.payment.findUnique({
    where: { reference: ref },
    include: {
      registration: {
        select: { reference: true, firstName: true, lastName: true },
      },
    },
  })

  if (!payment) notFound()

  const currency: Currency = isCurrency(payment.currency)
    ? payment.currency
    : 'SLE'

  const back = payment.registration
    ? `/register/${payment.registration.reference}`
    : '/'

  return (
    <div className="flex min-h-[70vh] items-center bg-slate-100 py-12">
      <Container size="narrow">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 pb-5">
            <p className="font-mono text-sm font-bold uppercase tracking-widest text-slate-500">
              Sandbox PSP
            </p>
            <Icon name="shield" className="size-5 text-slate-400" />
          </div>

          <p className="mt-6 text-sm text-slate-500">Paying</p>
          <p className="mt-1 font-display text-3xl font-bold text-slate-900">
            {formatMoney(payment.amountMinor, currency, { withCode: true })}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            to Freetown Business Forum
          </p>

          <dl className="mt-6 space-y-2 border-t border-slate-200 pt-5 text-sm">
            <Row label="Reference" value={payment.reference} />
            {payment.registration && (
              <Row
                label="Cardholder"
                value={`${payment.registration.firstName} ${payment.registration.lastName}`}
              />
            )}
          </dl>

          <div className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
            No card form, because there is no card. This page stands in for the
            provider’s hosted page so the flow can be tested end to end. No
            money moves.
          </div>

          <div className="mt-6 space-y-3">
            <form action={sandboxApprove}>
              <input type="hidden" name="reference" value={payment.reference} />
              <input type="hidden" name="back" value={back} />
              <Button type="submit" variant="primary" size="lg" fullWidth>
                Approve payment
              </Button>
            </form>

            <form action={sandboxDecline}>
              <input type="hidden" name="reference" value={payment.reference} />
              <input type="hidden" name="back" value={back} />
              <Button type="submit" variant="outline" fullWidth>
                Decline
              </Button>
            </form>
          </div>
        </div>
      </Container>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="shrink-0 font-medium text-slate-900">{value}</dd>
    </div>
  )
}
