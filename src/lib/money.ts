/**
 * Money handling (NFR-11: SLE primary, USD display).
 *
 * Every amount in the system is an integer in the currency's minor unit. No
 * float ever touches a price, a discount, or a ledger entry — rounding is
 * explicit and happens once, at the point a percentage is applied.
 */

export type Currency = 'SLE' | 'USD'

export const CURRENCIES: Currency[] = ['SLE', 'USD']

const CURRENCY_META: Record<
  Currency,
  { symbol: string; code: string; label: string; minorUnits: number }
> = {
  SLE: { symbol: 'Le', code: 'SLE', label: 'Sierra Leonean leone', minorUnits: 2 },
  USD: { symbol: '$', code: 'USD', label: 'US dollar', minorUnits: 2 },
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as string[]).includes(value)
}

/** `12345` in SLE → `"Le 123.45"`. */
export function formatMoney(
  amountMinor: number,
  currency: Currency = 'SLE',
  options: { withCode?: boolean; compact?: boolean } = {},
): string {
  const meta = CURRENCY_META[currency] ?? CURRENCY_META.SLE
  const major = amountMinor / 10 ** meta.minorUnits

  // Whole amounts read better without trailing zeros on a narrow phone screen.
  const hasFraction = amountMinor % 10 ** meta.minorUnits !== 0
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: options.compact && !hasFraction ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major)

  // A word-like symbol needs a space — "Le 5,000", not "Le5,000" — whereas
  // "$ 150" would be wrong. The distinction is whether the symbol is a letter.
  const separator = /[a-z]$/i.test(meta.symbol) ? ' ' : ''

  return options.withCode
    ? `${meta.symbol}${separator}${formatted} ${meta.code}`
    : `${meta.symbol}${separator}${formatted}`
}

export function currencySymbol(currency: Currency): string {
  return (CURRENCY_META[currency] ?? CURRENCY_META.SLE).symbol
}

export function currencyLabel(currency: Currency): string {
  return (CURRENCY_META[currency] ?? CURRENCY_META.SLE).label
}

/** Parse user input ("1,250.50") into minor units. Returns null if invalid. */
export function parseMoneyToMinor(
  input: string,
  currency: Currency = 'SLE',
): number | null {
  const cleaned = input.replace(/[^0-9.\-]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const value = Number(cleaned)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 10 ** CURRENCY_META[currency].minorUnits)
}

/**
 * Apply a percentage discount, rounding half-up to the nearest minor unit.
 * Returns the discount amount, never the remainder, so callers subtract once
 * and the two figures always reconcile.
 */
export function percentOf(amountMinor: number, percent: number): number {
  return Math.round((amountMinor * percent) / 100)
}

/** Clamp a discount so it can never exceed the amount being discounted. */
export function capDiscount(amountMinor: number, discountMinor: number): number {
  return Math.max(0, Math.min(amountMinor, discountMinor))
}
