import Link from 'next/link'
import type { Metadata } from 'next'

import { RegisterSteps } from '@/components/site/register-steps'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  EmptyState,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { formatDateRange } from '@/lib/format'
import { formatMoney, isCurrency, type Currency } from '@/lib/money'
import { hasUsdPrice, buildQuote } from '@/lib/pricing'
import { listTicketTypes, quoteFor, remaining } from '@/lib/registration'
import { getCurrentEvent, getPageCopy } from '@/lib/settings'

/**
 * Register — step 1, ticket selection (SDR §4.9).
 *
 * A GET form. The selection lives in the query string, which means the whole
 * of step 1 is bookmarkable and shareable, the back button from step 2 returns
 * to the right state, and nothing here needs JavaScript to work — the quote is
 * recalculated on the server every time the form is submitted (NFR-01).
 *
 * The currency toggle and the promo field are both submit buttons on the same
 * form for the same reason. A delegate on a 3G handset pressing "USD" gets a
 * page, not a spinner.
 *
 * Prices shown here are an estimate and say so. The figure charged is
 * recomputed at step 2 from the ticket type and promo code ids — see the note
 * in lib/registration.ts.
 */

export const metadata: Metadata = {
  title: 'Register',
  description:
    'Register for the Freetown Business Forum — choose your ticket, pay by mobile money, card or invoice, and get your QR e-ticket.',
  alternates: { canonical: '/register' },
}

type Search = {
  ticket?: string
  qty?: string
  currency?: string
  promo?: string
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const [params, event, copy] = await Promise.all([
    searchParams,
    getCurrentEvent(),
    getPageCopy('register'),
  ])

  if (!event) {
    return (
      <>
        <RegisterCrumbs />
        <PageHero
          eyebrow={copy('eyebrow', 'Register')}
          title={copy('closedTitle', 'Registration is not')}
          accent={copy('closedAccent', 'open')}
          lead={copy(
            'closedLead',
            'Dates for the next forum have not been announced. Ask the secretariat to tell you when they are.',
          )}
        />
        <Section tone="white">
          <EmptyState
            title={copy(
              'closedEmptyTitle',
              'No forum is currently open for registration',
            )}
          >
            <ButtonLink href="/contact" variant="primary">
              {copy('notifyLabel', 'Tell me when it opens')}
            </ButtonLink>
          </EmptyState>
        </Section>
      </>
    )
  }

  const tickets = await listTicketTypes(event.id)

  const currency: Currency = isCurrency(params.currency)
    ? params.currency
    : 'SLE'
  const promo = (params.promo ?? '').trim().toUpperCase()

  const selected =
    tickets.find((ticket) => ticket.id === params.ticket) ?? tickets[0] ?? null

  const quantity = Math.max(1, Math.min(100, Number(params.qty) || 1))

  const loaded = selected
    ? await quoteFor({
        eventId: event.id,
        ticketTypeId: selected.id,
        quantity,
        currency,
        promoCode: promo || null,
      })
    : null

  const quoteResult = loaded?.ok ? loaded.result : null

  // Every ticket's line price for the radio list. Quantity 1 so the list reads
  // as a price list; the selected ticket's real total is in the summary.
  const unitQuotes = new Map(
    tickets.map((ticket) => [
      ticket.id,
      buildQuote({ ticket, quantity: 1, currency }),
    ]),
  )

  if (!event.registrationOpen || tickets.length === 0) {
    return (
      <>
        <RegisterCrumbs />
        <PageHero
          eyebrow={formatDateRange(event.startDate, event.endDate)}
          title={copy('soonTitle', 'Registration opens')}
          accent={copy('soonAccent', 'soon')}
          lead={`Tickets for ${event.name} are not on sale yet. The secretariat will announce the date.`}
        />
        <Section tone="white">
          <EmptyState
            title={copy('soonEmptyTitle', 'Tickets are not on sale')}
            message={copy(
              'soonEmptyMessage',
              'Ask to be told when registration opens, and you will hear before it is announced publicly.',
            )}
          >
            <ButtonLink href="/contact" variant="primary">
              {copy('notifyLabel', 'Tell me when it opens')}
            </ButtonLink>
          </EmptyState>
        </Section>
      </>
    )
  }

  return (
    <>
      <RegisterCrumbs />
      <RegisterSteps current={1} />

      <Section tone="white" size="wide" className="py-8 sm:py-10">
        <h1 className="text-3xl text-ink-950 sm:text-4xl">
          Register for {event.name}
        </h1>
        <p className="mt-3 text-ink-600">
          {formatDateRange(event.startDate, event.endDate)} ·{' '}
          {event.venueName}, {event.city}
        </p>
      </Section>

      <Section tone="white" size="wide" className="pt-0">
        {/*
          One form spanning both columns. The ticket radios, the quantity, the
          currency toggle and the promo field all submit to this same page; the
          Continue button is a link, because moving to step 2 is navigation and
          nothing has been written yet.
        */}
        <form action="/register" method="get">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
            {/* ── Tickets ─────────────────────────────────────────────── */}

            <div className="lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl text-ink-950 sm:text-2xl">
                  Choose your ticket
                </h2>

                <CurrencyToggle
                  current={currency}
                  ticketId={selected?.id}
                  quantity={quantity}
                  promo={promo}
                  anyUsd={tickets.some(hasUsdPrice)}
                />
              </div>

              <fieldset className="mt-6">
                <legend className="sr-only">Ticket type</legend>

                <div className="space-y-3">
                  {tickets.map((ticket) => {
                    const left = remaining(ticket)
                    const quote = unitQuotes.get(ticket.id)
                    const unavailable = !quote?.ok

                    return (
                      <label
                        key={ticket.id}
                        className={cn(
                          'flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition',
                          'border-ink-200 hover:border-forest-400',
                          'has-[:checked]:border-forest-600 has-[:checked]:bg-forest-50 has-[:checked]:ring-1 has-[:checked]:ring-forest-600',
                          'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 has-[:disabled]:hover:border-ink-200',
                        )}
                      >
                        <input
                          type="radio"
                          name="ticket"
                          value={ticket.id}
                          defaultChecked={ticket.id === selected?.id}
                          disabled={unavailable}
                          className="mt-1 size-4 shrink-0 accent-forest-600"
                        />

                        <span className="flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="font-display font-semibold text-ink-950">
                              {ticket.name}
                            </span>
                            <span className="font-semibold text-forest-700">
                              {quote?.ok
                                ? formatMoney(
                                    quote.quote.unitPriceMinor,
                                    currency,
                                    { compact: true },
                                  )
                                : '—'}
                            </span>
                          </span>

                          {ticket.description && (
                            <span className="mt-1 block text-sm text-ink-600">
                              {ticket.description}
                            </span>
                          )}

                          <span className="mt-2 flex flex-wrap items-center gap-2">
                            {ticket.isGroup && ticket.groupMinSize && (
                              <Badge tone="harbour">
                                {ticket.groupMinSize}+ delegates
                                {ticket.groupDiscountPercent
                                  ? `, ${ticket.groupDiscountPercent}% off`
                                  : ''}
                              </Badge>
                            )}

                            {/* A count is only shown when it is low enough to
                                matter — "412 left" is noise, "6 left" is a
                                reason to book now, and neither is a lie. */}
                            {left !== null && left > 0 && left <= 20 && (
                              <Badge tone="warning">{left} left</Badge>
                            )}

                            {left === 0 && <Badge tone="danger">Sold out</Badge>}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              {/* ── Quantity & promo ──────────────────────────────────── */}

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="qty"
                    className="block text-sm font-medium text-ink-900"
                  >
                    How many delegates?
                  </label>
                  <input
                    id="qty"
                    name="qty"
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    defaultValue={quantity}
                    className="mt-1.5 block w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2.5 text-base text-ink-950 focus:border-forest-600"
                  />
                  <p className="mt-1.5 text-xs text-ink-600">
                    Group rates apply automatically once the threshold is met.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="promo"
                    className="block text-sm font-medium text-ink-900"
                  >
                    Promo code
                    <span className="ml-1.5 text-xs font-normal text-ink-500">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="promo"
                    name="promo"
                    defaultValue={promo}
                    autoCapitalize="characters"
                    className="mt-1.5 block w-full rounded-lg border border-ink-300 bg-white px-3.5 py-2.5 text-base uppercase text-ink-950 focus:border-forest-600"
                  />
                  {quoteResult?.ok && quoteResult.promoError && (
                    <p className="mt-1.5 text-sm text-red-700">
                      {promoErrorMessage(quoteResult.promoError)}
                    </p>
                  )}
                </div>
              </div>

              <input type="hidden" name="currency" value={currency} />

              <button
                type="submit"
                className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink-300 bg-white px-5 py-2.5 text-sm font-medium text-ink-900 hover:border-forest-600 hover:text-forest-700"
              >
                <Icon name="check" className="size-4" />
                Update the price
              </button>
            </div>

            {/* ── Summary ─────────────────────────────────────────────── */}

            <div className="lg:col-span-5">
              <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
                <h2 className="font-display text-lg font-semibold text-ink-950">
                  Your order
                </h2>

                {!selected || !quoteResult ? (
                  <p className="mt-4 text-sm text-ink-600">
                    Choose a ticket to see the price.
                  </p>
                ) : !quoteResult.ok ? (
                  <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">
                    {quoteResult.message}
                  </div>
                ) : (
                  <>
                    <dl className="mt-5 space-y-3 border-t border-ink-200 pt-5 text-sm">
                      <Line
                        label={`${selected.name} × ${quoteResult.quote.quantity}`}
                        value={formatMoney(
                          quoteResult.quote.subtotalMinor,
                          currency,
                        )}
                      />

                      {quoteResult.quote.discounts.map((discount) => (
                        <Line
                          key={discount.label}
                          label={discount.label}
                          value={`− ${formatMoney(discount.amountMinor, currency)}`}
                          tone="discount"
                        />
                      ))}
                    </dl>

                    <div className="mt-5 flex items-baseline justify-between border-t-2 border-ink-950 pt-5">
                      <span className="font-display font-semibold text-ink-950">
                        Total
                      </span>
                      <span className="font-display text-2xl font-bold text-ink-950">
                        {formatMoney(quoteResult.quote.totalMinor, currency, {
                          withCode: true,
                        })}
                      </span>
                    </div>

                    <p className="mt-3 text-xs text-ink-500">
                      An estimate. The amount charged is recalculated on the
                      next step from the current prices.
                    </p>

                    <ButtonLink
                      href={{
                        pathname: '/register/details',
                        query: {
                          ticket: selected.id,
                          qty: String(quoteResult.quote.quantity),
                          currency,
                          ...(promo ? { promo } : {}),
                        },
                      }}
                      variant="accent"
                      size="lg"
                      fullWidth
                      className="mt-6 rounded-none font-semibold uppercase tracking-wider"
                    >
                      Continue
                      <Icon name="arrowRight" className="size-5" />
                    </ButtonLink>
                  </>
                )}

                <ul className="mt-6 space-y-2 border-t border-ink-200 pt-5 text-sm text-ink-600">
                  <Assurance>Orange Money, Afrimoney, card or invoice</Assurance>
                  <Assurance>QR e-ticket by email — nothing to print</Assurance>
                  <Assurance>No account needed to register</Assurance>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </Section>

      <Section tone="muted">
        <Container size="narrow" className="px-0">
          <h2 className="text-xl text-ink-950">Registering a group?</h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Book the whole group in one go — the group rate applies
            automatically, one invoice covers everyone, and you can name the
            individual delegates afterwards. For more than a hundred, or for a
            delegation that needs invoicing to a ministry,{' '}
            <Link
              href="/contact"
              className="font-medium text-forest-700 hover:underline"
            >
              talk to the secretariat
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  )
}

function RegisterCrumbs() {
  return (
    <Breadcrumbs
      items={[
        { label: 'Home', href: '/' },
        { label: 'Events', href: '/events' },
        { label: 'Register', href: '/register' },
      ]}
    />
  )
}

/**
 * The SLE / USD toggle (§4.9 step 1, "prices in SLE, USD toggle").
 *
 * Links rather than a select, so switching is a navigation the browser
 * handles. Hidden entirely when no ticket carries a published USD price —
 * offering a currency that would silently fall back to the leone figure would
 * be worse than not offering it (see `unitPrice` in lib/pricing.ts).
 */
function CurrencyToggle({
  current,
  ticketId,
  quantity,
  promo,
  anyUsd,
}: {
  current: Currency
  ticketId: string | undefined
  quantity: number
  promo: string
  anyUsd: boolean
}) {
  if (!anyUsd) return null

  const href = (currency: Currency) => {
    const params = new URLSearchParams()
    if (ticketId) params.set('ticket', ticketId)
    params.set('qty', String(quantity))
    params.set('currency', currency)
    if (promo) params.set('promo', promo)
    return `/register?${params.toString()}`
  }

  return (
    <div
      role="group"
      aria-label="Display currency"
      className="inline-flex rounded-lg border border-ink-300 p-0.5"
    >
      {(['SLE', 'USD'] as const).map((code) => (
        <Link
          key={code}
          href={href(code)}
          aria-current={current === code ? 'true' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium',
            current === code
              ? 'bg-ink-950 text-white'
              : 'text-ink-700 hover:text-forest-700',
          )}
        >
          {code}
        </Link>
      ))}
    </div>
  )
}

function Line({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'discount'
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={cn(tone === 'discount' ? 'text-forest-700' : 'text-ink-700')}>
        {label}
      </dt>
      <dd
        className={cn(
          'shrink-0 tabular-nums',
          tone === 'discount' ? 'text-forest-700' : 'font-medium text-ink-950',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function Assurance({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <Icon name="check" className="mt-0.5 size-4 shrink-0 text-forest-600" />
      <span>{children}</span>
    </li>
  )
}

function promoErrorMessage(error: string): string {
  const messages: Record<string, string> = {
    NOT_FOUND: 'That promo code was not recognised.',
    INACTIVE: 'That promo code is no longer active.',
    NOT_YET_VALID: 'That promo code is not valid yet.',
    EXPIRED: 'That promo code has expired.',
    FULLY_REDEEMED: 'That promo code has reached its limit.',
    WRONG_TICKET_TYPE: 'That code does not apply to this ticket.',
  }
  return messages[error] ?? 'That promo code could not be applied.'
}
