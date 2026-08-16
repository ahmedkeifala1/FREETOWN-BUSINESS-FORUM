import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Buttons and button-shaped links (SDR §3.5 "reusable UI patterns").
 *
 * `Button` renders a <button>, `ButtonLink` a Next <Link> — they share the
 * variant map so a "Register" link and a "Register" submit button are
 * indistinguishable on screen. Choosing between them is a question of what the
 * control does, not how it looks: anything that navigates is a link, so it
 * opens in a new tab on middle-click and works before JavaScript loads.
 *
 * Touch targets are at least 44px tall at every size (§4.17 "touch-friendly
 * targets", WCAG 2.5.5).
 */

type Variant = 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-forest-600 text-white hover:bg-forest-700 active:bg-forest-800 shadow-sm',
  secondary:
    'bg-harbour-600 text-white hover:bg-harbour-700 active:bg-harbour-800 shadow-sm',
  // The accent is reserved for the single most important CTA on a view (§3.2).
  accent:
    'bg-gold-600 text-white hover:bg-gold-700 active:bg-gold-800 shadow-sm',
  outline:
    'border border-ink-300 bg-white text-ink-900 hover:border-forest-600 hover:text-forest-700 active:bg-forest-50',
  ghost: 'text-ink-700 hover:bg-ink-100 hover:text-ink-950 active:bg-ink-200',
  danger: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-900 shadow-sm',
}

const SIZES: Record<Size, string> = {
  sm: 'min-h-11 px-3.5 py-2 text-sm gap-1.5',
  md: 'min-h-11 px-5 py-2.5 text-sm gap-2 sm:text-base',
  lg: 'min-h-12 px-6 py-3 text-base gap-2 sm:text-lg',
}

const BASE =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors ' +
  'disabled:pointer-events-none disabled:opacity-55 ' +
  'aria-disabled:pointer-events-none aria-disabled:opacity-55'

type SharedProps = {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  className?: string
  children: ReactNode
}

function classes({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
}: Omit<SharedProps, 'children'>): string {
  return cn(
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  )
}

export function Button({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: SharedProps & Omit<ComponentProps<'button'>, 'className' | 'children'>) {
  return (
    <button
      // An explicit type: an unmarked <button> inside a form submits it, which
      // is rarely what a secondary control is meant to do.
      type={props.type ?? 'button'}
      className={classes({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: SharedProps & Omit<ComponentProps<typeof Link>, 'className' | 'children'>) {
  return (
    <Link
      className={classes({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </Link>
  )
}

/** An <a> for addresses Next's router should not handle — tel:, mailto:, PDFs. */
export function ButtonAnchor({
  variant,
  size,
  fullWidth,
  className,
  children,
  ...props
}: SharedProps & Omit<ComponentProps<'a'>, 'className' | 'children'>) {
  return (
    <a
      className={classes({ variant, size, fullWidth, className })}
      {...props}
    >
      {children}
    </a>
  )
}
