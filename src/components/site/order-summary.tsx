import { cn } from '@/lib/cn'
import { formatMoney, type Currency } from '@/lib/money'
import type { DiscountLine } from '@/lib/pricing'

/**
 * The order summary panel, shared by steps 2, 3 and 4 of registration (§4.9).
 *
 * One component so the figures are laid out identically at every step — a
 * total that moves position or changes wording between the review screen and
 * the receipt reads as a different number, even when it is not.
 */

export function OrderSummary({
  title = 'Your order',
  ticketName,
  quantity,
  currency,
  subtotalMinor,
  discounts,
  totalMinor,
  footnote,
  children,
}: {
  title?: string
  ticketName: string
  quantity: number
  currency: Currency
  subtotalMinor: number
  discounts: DiscountLine[]
  totalMinor: number
  footnote?: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-ink-950">
        {title}
      </h2>

      <dl className="mt-5 space-y-3 border-t border-ink-200 pt-5 text-sm">
        <Line
          label={`${ticketName} × ${quantity}`}
          value={formatMoney(subtotalMinor, currency)}
        />

        {discounts.map((discount) => (
          <Line
            key={discount.label}
            label={discount.label}
            value={`− ${formatMoney(discount.amountMinor, currency)}`}
            tone="discount"
          />
        ))}
      </dl>

      <div className="mt-5 flex items-baseline justify-between border-t-2 border-ink-950 pt-5">
        <span className="font-display font-semibold text-ink-950">Total</span>
        <span className="font-display text-2xl font-bold text-ink-950">
          {formatMoney(totalMinor, currency, { withCode: true })}
        </span>
      </div>

      {footnote && <p className="mt-3 text-xs text-ink-500">{footnote}</p>}

      {children && <div className="mt-6">{children}</div>}
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
      <dt className={tone === 'discount' ? 'text-forest-700' : 'text-ink-700'}>
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
