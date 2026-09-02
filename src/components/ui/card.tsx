import Link from 'next/link'
import type { ReactNode } from 'react'

import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { formatMoney, isCurrency, type Currency } from '@/lib/money'

/**
 * Cards and badges (§3.5 "card grid", "stat counters").
 *
 * `Card` is the plain container; `LinkCard` is the whole-card-is-a-link
 * variant used by the news, speaker, sector and directory grids. The link
 * wraps the entire card rather than just the title, because a 44px title on a
 * phone is a hard target to hit — but the heading still carries the accessible
 * name, so a screen reader announces "Agriculture & Agribusiness, link" and
 * not the whole card's text.
 */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-200 bg-white shadow-sm',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function LinkCard({
  href,
  children,
  className,
  padded = true,
}: {
  href: string
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col rounded-xl border border-ink-200 bg-white shadow-sm transition',
        'hover:border-forest-300 hover:shadow-md',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {children}
    </Link>
  )
}

type BadgeTone =
  | 'forest'
  | 'harbour'
  | 'gold'
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'

const BADGE_TONES: Record<BadgeTone, string> = {
  forest: 'bg-forest-50 text-forest-800 ring-forest-200',
  harbour: 'bg-harbour-50 text-harbour-800 ring-harbour-200',
  gold: 'bg-gold-50 text-gold-800 ring-gold-200',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  success: 'bg-green-50 text-green-800 ring-green-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  danger: 'bg-red-50 text-red-800 ring-red-200',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * A headline figure (§4.2 "key stats as counters").
 *
 * Rendered as static text rather than an animated count-up: the animation
 * needs client JavaScript on the critical path, and on a 3G handset the number
 * would sit at zero exactly when the visitor is deciding whether the page is
 * worth waiting for (NFR-01).
 */
export function Stat({
  value,
  label,
  inverted = false,
}: {
  value: string
  label: string
  inverted?: boolean
}) {
  return (
    <div>
      <p
        className={cn(
          'font-display text-3xl font-bold sm:text-4xl',
          inverted ? 'text-gold-300' : 'text-forest-700',
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          'mt-1 text-sm',
          inverted ? 'text-white/75' : 'text-ink-600',
        )}
      >
        {label}
      </p>
    </div>
  )
}

/**
 * Avatar with initials fallback.
 *
 * Speaker and member photographs are optional in the CMS, and a grid where
 * some cards have a broken-image icon looks unfinished — the initials tile is
 * the same size and shape, so the grid stays even however many photos the
 * secretariat has managed to collect.
 */
export function Avatar({
  src,
  name,
  initials,
  size = 'md',
  className,
}: {
  src?: string | null
  name: string
  initials: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'size-10 text-sm',
    md: 'size-16 text-lg',
    lg: 'size-24 text-2xl',
  }

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- CMS URLs are
      // arbitrary remote hosts; next/image would need each one allow-listed in
      // next.config.ts, which the secretariat cannot do from the admin panel.
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        className={cn(
          'shrink-0 rounded-full bg-ink-100 object-cover',
          sizes[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-forest-100 font-display font-semibold text-forest-800',
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  )
}

/**
 * The ticket size on a Deal Room proposition (§4.12 "filterable cards … ticket
 * size").
 *
 * Written as a range, a floor or a ceiling depending on which bounds the
 * business actually gave, rather than printing a zero for the missing one — a
 * proposition that says "from Le 0" reads as a data-entry error, and on a page
 * asking investors for money that costs it more credibility than the missing
 * number does.
 *
 * Renders nothing at all when neither bound is set. An empty row is worse than
 * no row: it invites the reader to wonder what was meant to be there.
 */
export function TicketSize({
  min,
  max,
  currency,
}: {
  min: number | null
  max: number | null
  currency: string
}) {
  const unit: Currency = isCurrency(currency) ? currency : 'USD'
  const money = (minor: number) => formatMoney(minor, unit, { compact: true })

  let text: string | null = null
  if (min && max) text = `${money(min)} – ${money(max)}`
  else if (min) text = `from ${money(min)}`
  else if (max) text = `up to ${money(max)}`

  if (!text) return null

  return (
    <div className="flex items-center gap-1.5 font-medium text-ink-900">
      <Icon name="trending" className="size-4 shrink-0 text-forest-600" />
      <span>{text}</span>
    </div>
  )
}
