import 'server-only'

import { db } from '@/lib/db'
import type { Currency } from '@/lib/money'
import {
  buildQuote,
  type PricingPromoCode,
  type PricingTicketType,
  type QuoteResult,
} from '@/lib/pricing'

/**
 * Loading and pricing a registration (§4.9, FR-06).
 *
 * `quoteFor` is the single place a price is produced. Step 1 renders it, step 2
 * renders it again, and the action that creates the Registration calls it a
 * third time — every one of those from the ticket type id and the promo code
 * text, never from a number that came back through a form. A delegate who
 * edits the hidden total in dev tools changes nothing (see the note on
 * lib/pricing.ts).
 *
 * That the quote is recomputed on each render is also what makes the flow
 * safe to leave open: a ticket that sells out, or a promo code that expires,
 * between step 1 and step 3 fails at the point of purchase rather than being
 * honoured from a stale copy.
 */

/** The columns pricing needs, and nothing else. */
const TICKET_PRICING_SELECT = {
  id: true,
  name: true,
  priceMinor: true,
  priceMinorUSD: true,
  currency: true,
  minQuantity: true,
  maxQuantity: true,
  capacity: true,
  sold: true,
  isActive: true,
  salesStart: true,
  salesEnd: true,
  isGroup: true,
  groupMinSize: true,
  groupDiscountPercent: true,
} as const

export type QuoteInput = {
  eventId: string
  ticketTypeId: string
  quantity: number
  currency: Currency
  promoCode?: string | null
}

export type LoadedQuote =
  | {
      ok: true
      ticket: PricingTicketType & { name: string }
      promo: PricingPromoCode | null
      result: QuoteResult
    }
  | { ok: false; reason: 'TICKET_NOT_FOUND' }

/**
 * Load the ticket type and promo code, then price them.
 *
 * A promo code that does not exist is not an error here — `buildQuote`
 * returns a valid quote alongside `promoError`, so the delegate sees "code not
 * recognised" beside a working Continue button rather than a dead end.
 */
export async function quoteFor(input: QuoteInput): Promise<LoadedQuote> {
  const ticket = await db.ticketType.findFirst({
    where: { id: input.ticketTypeId, eventId: input.eventId },
    select: TICKET_PRICING_SELECT,
  })

  if (!ticket) return { ok: false, reason: 'TICKET_NOT_FOUND' }

  const promo = input.promoCode
    ? await db.promoCode.findFirst({
        where: { code: input.promoCode.toUpperCase() },
        select: {
          id: true,
          code: true,
          discountType: true,
          discountValue: true,
          maxRedemptions: true,
          timesRedeemed: true,
          validFrom: true,
          validUntil: true,
          isActive: true,
          ticketTypeId: true,
          eventId: true,
        },
      })
    : null

  // Distinguish "no code entered" from "code entered but unknown": passing
  // `undefined` skips promo handling entirely, `null` reports NOT_FOUND.
  const promoArgument = input.promoCode ? promo : undefined

  return {
    ok: true,
    ticket,
    promo,
    result: buildQuote({
      ticket,
      quantity: input.quantity,
      currency: input.currency,
      promo: promoArgument,
    }),
  }
}

/** Ticket types offered on step 1, in display order. */
export async function listTicketTypes(eventId: string) {
  return db.ticketType.findMany({
    where: { eventId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { ...TICKET_PRICING_SELECT, slug: true, description: true },
  })
}

/**
 * Tickets left, or null when the type is uncapped.
 *
 * `sold` is incremented when a registration is confirmed, not when it is
 * created, so this is deliberately optimistic — a pending registration does
 * not hold a seat. That matches how the secretariat runs the desk: an unpaid
 * booking is not a booking, and holding inventory for abandoned checkouts on a
 * flaky connection would quietly sell out the forum.
 */
export function remaining(ticket: {
  capacity: number | null
  sold: number
}): number | null {
  if (ticket.capacity === null) return null
  return Math.max(0, ticket.capacity - ticket.sold)
}
