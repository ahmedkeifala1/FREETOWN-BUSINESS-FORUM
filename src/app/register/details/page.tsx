import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { OrderSummary } from '@/components/site/order-summary'
import { RegisterSteps } from '@/components/site/register-steps'
import { RegistrationDetailsForm } from '@/components/site/registration-details-form'
import { Icon } from '@/components/ui/icon'
import { Breadcrumbs, Section } from '@/components/ui/layout'
import { formatDateRange } from '@/lib/format'
import { isCurrency, type Currency } from '@/lib/money'
import { quoteFor } from '@/lib/registration'
import { getCurrentEvent } from '@/lib/settings'

/**
 * Register — step 2, delegate details (§4.9).
 *
 * The selection arrives in the query string from step 1 and is priced again
 * here, from the ticket type and promo code ids. Anything that cannot be
 * priced — a ticket that sold out while the delegate was deciding, a code that
 * expired — sends them back to step 1 with the problem visible there, rather
 * than letting them fill in a form that will fail on submit.
 */

export const metadata: Metadata = {
  title: 'Your details',
  description: 'Step 2 of registering for the Freetown Business Forum.',
  robots: { index: false, follow: false },
}

type Search = {
  ticket?: string
  qty?: string
  currency?: string
  promo?: string
}

export default async function RegisterDetailsPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const [params, event] = await Promise.all([searchParams, getCurrentEvent()])

  if (!event || !event.registrationOpen || !params.ticket) redirect('/register')

  const currency: Currency = isCurrency(params.currency)
    ? params.currency
    : 'SLE'
  const promo = (params.promo ?? '').trim().toUpperCase()
  const quantity = Math.max(1, Math.min(100, Number(params.qty) || 1))

  const loaded = await quoteFor({
    eventId: event.id,
    ticketTypeId: params.ticket,
    quantity,
    currency,
    promoCode: promo || null,
  })

  // Anything unpriceable goes back to step 1, where the ticket list will show
  // why. Redirecting is better than an error page here: the delegate's next
  // action is always "pick a different ticket".
  if (!loaded.ok || !loaded.result.ok) redirect('/register')

  const quote = loaded.result.quote

  // A promo that stopped validating between steps is dropped rather than
  // carried silently — the total below is what will be charged.
  const promoApplied = quote.discounts.some((line) => line.kind === 'PROMO')

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Register', href: '/register' },
          { label: 'Your details', href: '/register/details' },
        ]}
      />
      <RegisterSteps current={2} />

      <Section tone="white" size="wide" className="py-8 sm:py-10">
        <h1 className="text-3xl text-ink-950 sm:text-4xl">Your details</h1>
        <p className="mt-3 text-ink-600">
          {event.name} · {formatDateRange(event.startDate, event.endDate)}
        </p>
      </Section>

      <Section tone="white" size="wide" className="pt-0">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <RegistrationDetailsForm
              selection={{
                eventId: event.id,
                ticketTypeId: loaded.ticket.id,
                quantity: quote.quantity,
                currency,
                promoCode: promoApplied ? promo : '',
              }}
              isGroup={quote.quantity > 1}
            />
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <OrderSummary
                ticketName={loaded.ticket.name}
                quantity={quote.quantity}
                currency={currency}
                subtotalMinor={quote.subtotalMinor}
                discounts={quote.discounts}
                totalMinor={quote.totalMinor}
                footnote="This is the amount that will be charged. Nothing is taken until you choose a payment method on the next step."
              >
                <Link
                  href={{
                    pathname: '/register',
                    query: {
                      ticket: loaded.ticket.id,
                      qty: String(quote.quantity),
                      currency,
                      ...(promo ? { promo } : {}),
                    },
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
                >
                  <Icon name="arrowRight" className="size-4 rotate-180" />
                  Change tickets
                </Link>
              </OrderSummary>
            </div>
          </div>
        </div>
      </Section>
    </>
  )
}
