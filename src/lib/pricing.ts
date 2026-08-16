import { capDiscount, percentOf, type Currency } from '@/lib/money'
import { DiscountType } from '@/lib/enums'

/**
 * Dynamic ticket pricing (FR-06): tiered prices, group discounts and promo
 * codes, calculated server-side.
 *
 * The quote is computed in one place and returned as a breakdown so the same
 * numbers drive the review screen, the stored Registration, the Payment, and
 * the receipt. The browser never computes a price it can submit — step 1 of
 * §4.9 shows an estimate, but the figure that is charged is always recomputed
 * here from the ticket type and promo code IDs.
 */

export type PricingTicketType = {
  id: string
  name: string
  priceMinor: number
  priceMinorUSD: number | null
  currency: string
  minQuantity: number
  maxQuantity: number
  capacity: number | null
  sold: number
  isActive: boolean
  salesStart: Date | null
  salesEnd: Date | null
  isGroup: boolean
  groupMinSize: number | null
  groupDiscountPercent: number | null
}

export type PricingPromoCode = {
  id: string
  code: string
  discountType: string
  discountValue: number
  maxRedemptions: number | null
  timesRedeemed: number
  validFrom: Date | null
  validUntil: Date | null
  isActive: boolean
  ticketTypeId: string | null
  eventId: string | null
}

export type DiscountLine = {
  kind: 'GROUP' | 'PROMO'
  label: string
  amountMinor: number
}

export type Quote = {
  currency: Currency
  unitPriceMinor: number
  quantity: number
  subtotalMinor: number
  discounts: DiscountLine[]
  discountMinor: number
  totalMinor: number
}

export type QuoteError =
  | 'TICKET_INACTIVE'
  | 'SALES_NOT_OPEN'
  | 'SALES_CLOSED'
  | 'SOLD_OUT'
  | 'INSUFFICIENT_CAPACITY'
  | 'QUANTITY_TOO_LOW'
  | 'QUANTITY_TOO_HIGH'
  | 'GROUP_MIN_NOT_MET'

export type QuoteResult =
  | { ok: true; quote: Quote; promoError?: PromoError }
  | { ok: false; error: QuoteError; message: string }

export type PromoError =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'FULLY_REDEEMED'
  | 'WRONG_TICKET_TYPE'

export const QUOTE_ERROR_MESSAGES: Record<QuoteError, string> = {
  TICKET_INACTIVE: 'That ticket type is no longer available.',
  SALES_NOT_OPEN: 'Sales for this ticket have not opened yet.',
  SALES_CLOSED: 'Sales for this ticket have closed.',
  SOLD_OUT: 'This ticket type is sold out.',
  INSUFFICIENT_CAPACITY: 'There are not enough tickets left for that quantity.',
  QUANTITY_TOO_LOW: 'Please increase the number of delegates.',
  QUANTITY_TOO_HIGH: 'That exceeds the maximum for this ticket type.',
  GROUP_MIN_NOT_MET: 'This group rate requires a larger booking.',
}

export const PROMO_ERROR_MESSAGES: Record<PromoError, string> = {
  NOT_FOUND: 'That promo code was not recognised.',
  INACTIVE: 'That promo code is no longer active.',
  NOT_YET_VALID: 'That promo code is not valid yet.',
  EXPIRED: 'That promo code has expired.',
  FULLY_REDEEMED: 'That promo code has reached its redemption limit.',
  WRONG_TICKET_TYPE: 'That promo code does not apply to this ticket type.',
}

/** Price for a ticket in the requested display currency (NFR-11). */
export function unitPrice(
  ticket: PricingTicketType,
  currency: Currency,
): number {
  if (currency === 'USD') {
    // Fall back to the SLE price only if no USD price was published; the
    // caller decides whether to show it.
    return ticket.priceMinorUSD ?? ticket.priceMinor
  }
  return ticket.priceMinor
}

export function hasUsdPrice(ticket: PricingTicketType): boolean {
  return ticket.priceMinorUSD !== null
}

function validatePromo(
  promo: PricingPromoCode | null,
  ticket: PricingTicketType,
  now: Date,
): PromoError | null {
  if (!promo) return 'NOT_FOUND'
  if (!promo.isActive) return 'INACTIVE'
  if (promo.validFrom && promo.validFrom > now) return 'NOT_YET_VALID'
  if (promo.validUntil && promo.validUntil < now) return 'EXPIRED'
  if (
    promo.maxRedemptions !== null &&
    promo.timesRedeemed >= promo.maxRedemptions
  ) {
    return 'FULLY_REDEEMED'
  }
  if (promo.ticketTypeId && promo.ticketTypeId !== ticket.id) {
    return 'WRONG_TICKET_TYPE'
  }
  return null
}

/**
 * Build a priced quote.
 *
 * An invalid promo code does not fail the whole quote — the caller gets a
 * priced quote plus `promoError`, so the delegate sees "code not recognised"
 * next to a still-working Continue button rather than a dead end.
 */
export function buildQuote(input: {
  ticket: PricingTicketType
  quantity: number
  currency: Currency
  promo?: PricingPromoCode | null
  now?: Date
}): QuoteResult {
  const { ticket, quantity, currency } = input
  const now = input.now ?? new Date()

  if (!ticket.isActive) {
    return fail('TICKET_INACTIVE')
  }
  if (ticket.salesStart && ticket.salesStart > now) {
    return fail('SALES_NOT_OPEN')
  }
  if (ticket.salesEnd && ticket.salesEnd < now) {
    return fail('SALES_CLOSED')
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return fail('QUANTITY_TOO_LOW')
  }
  if (quantity < ticket.minQuantity) {
    return fail('QUANTITY_TOO_LOW')
  }
  if (quantity > ticket.maxQuantity) {
    return fail('QUANTITY_TOO_HIGH')
  }
  if (ticket.isGroup && ticket.groupMinSize && quantity < ticket.groupMinSize) {
    return fail('GROUP_MIN_NOT_MET')
  }

  if (ticket.capacity !== null) {
    const remaining = ticket.capacity - ticket.sold
    if (remaining <= 0) return fail('SOLD_OUT')
    if (remaining < quantity) return fail('INSUFFICIENT_CAPACITY')
  }

  const unit = unitPrice(ticket, currency)
  const subtotalMinor = unit * quantity

  const discounts: DiscountLine[] = []

  // Group discount applies automatically once the threshold is reached, and is
  // calculated on the subtotal before any promo code.
  if (
    ticket.groupDiscountPercent &&
    ticket.groupMinSize &&
    quantity >= ticket.groupMinSize
  ) {
    const amount = percentOf(subtotalMinor, ticket.groupDiscountPercent)
    if (amount > 0) {
      discounts.push({
        kind: 'GROUP',
        label: `Group rate (${ticket.groupDiscountPercent}% off ${quantity} delegates)`,
        amountMinor: amount,
      })
    }
  }

  let promoError: PromoError | undefined
  if (input.promo !== undefined && input.promo !== null) {
    const error = validatePromo(input.promo, ticket, now)
    if (error) {
      promoError = error
    } else {
      const promo = input.promo
      // Promo applies to the subtotal net of the group discount, so stacking
      // the two can never take the total below zero.
      const alreadyDiscounted = discounts.reduce(
        (sum, d) => sum + d.amountMinor,
        0,
      )
      const base = subtotalMinor - alreadyDiscounted
      const raw =
        promo.discountType === DiscountType.PERCENT
          ? percentOf(base, promo.discountValue)
          : promo.discountValue
      const amount = capDiscount(base, raw)

      if (amount > 0) {
        discounts.push({
          kind: 'PROMO',
          label:
            promo.discountType === DiscountType.PERCENT
              ? `Promo code ${promo.code} (${promo.discountValue}% off)`
              : `Promo code ${promo.code}`,
          amountMinor: amount,
        })
      }
    }
  }

  const discountMinor = discounts.reduce((sum, d) => sum + d.amountMinor, 0)
  const totalMinor = Math.max(0, subtotalMinor - discountMinor)

  return {
    ok: true,
    promoError,
    quote: {
      currency,
      unitPriceMinor: unit,
      quantity,
      subtotalMinor,
      discounts,
      discountMinor,
      totalMinor,
    },
  }
}

function fail(error: QuoteError): QuoteResult {
  return { ok: false, error, message: QUOTE_ERROR_MESSAGES[error] }
}
