import Link from 'next/link'
import type { ElementType, ReactNode } from 'react'

import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/**
 * Page scaffolding: containers, sections, headings and grids (§3.5, §4.17).
 *
 * Every page is built from these rather than from ad-hoc padding, so the
 * horizontal rhythm is identical throughout and the responsive reflow rules
 * (3-up → 2-up → 1-up) are defined once.
 */

export function Container({
  children,
  className,
  size = 'default',
}: {
  children: ReactNode
  className?: string
  size?: 'default' | 'narrow' | 'wide'
}) {
  const widths = {
    narrow: 'max-w-3xl',
    default: 'max-w-6xl',
    wide: 'max-w-7xl',
  }

  return (
    <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', widths[size], className)}>
      {children}
    </div>
  )
}

/**
 * Breadcrumb trail for interior pages.
 *
 * The last crumb is the current page and is rendered as text rather than a
 * link — a link to where you already are is a dead control for a keyboard or
 * screen-reader user (NFR-09). `aria-current="page"` says the same thing to
 * assistive technology that the darker weight says visually.
 */
export function Breadcrumbs({
  items,
  className,
}: {
  items: Array<{ label: string; href: string }>
  className?: string
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('border-b border-ink-200 bg-ink-50', className)}
    >
      <Container>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 py-3 text-sm text-ink-600">
          {items.map((item, index) => {
            const isLast = index === items.length - 1

            return (
              <li key={item.href} className="flex items-center gap-2">
                {index > 0 && (
                  <span aria-hidden="true" className="text-ink-400">
                    /
                  </span>
                )}
                {isLast ? (
                  <span aria-current="page" className="font-medium text-ink-950">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="hover:text-forest-700 hover:underline">
                    {item.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </Container>
    </nav>
  )
}

export function Section({
  children,
  className,
  tone = 'white',
  id,
  as: Tag = 'section',
  size = 'default',
}: {
  children: ReactNode
  className?: string
  /** Alternating tones give the long homepage its visual rhythm (§4.2). */
  tone?: 'white' | 'muted' | 'forest' | 'harbour' | 'ink'
  id?: string
  as?: ElementType
  size?: 'default' | 'narrow' | 'wide'
}) {
  const tones = {
    white: 'bg-white text-ink-950',
    muted: 'bg-ink-50 text-ink-950',
    forest: 'bg-forest-800 text-white',
    harbour: 'bg-harbour-800 text-white',
    ink: 'bg-ink-950 text-white',
  }

  return (
    <Tag
      id={id}
      className={cn('py-12 sm:py-16 lg:py-20', tones[tone], className)}
    >
      <Container size={size}>{children}</Container>
    </Tag>
  )
}

/**
 * Section heading with an optional eyebrow and lead paragraph.
 *
 * `inverted` switches the palette for use on the dark section tones — passing
 * it is less error-prone than remembering which four text classes to override.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  inverted = false,
  as: Tag = 'h2',
  className,
}: {
  eyebrow?: string
  title: string
  lead?: string
  align?: 'left' | 'center'
  inverted?: boolean
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-w-3xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && (
        <p
          className={cn(
            'mb-2 text-sm font-semibold uppercase tracking-wider',
            inverted ? 'text-gold-300' : 'text-forest-700',
          )}
        >
          {eyebrow}
        </p>
      )}

      <Tag
        className={cn(
          Tag === 'h1'
            ? 'text-3xl sm:text-4xl lg:text-5xl'
            : 'text-2xl sm:text-3xl lg:text-4xl',
          inverted ? 'text-white' : 'text-ink-950',
        )}
      >
        {title}
      </Tag>

      {lead && (
        <p
          className={cn(
            'mt-4 text-base leading-relaxed sm:text-lg',
            inverted ? 'text-white/85' : 'text-ink-700',
          )}
        >
          {lead}
        </p>
      )}
    </div>
  )
}

/**
 * Responsive card grid. Columns are the count at the widest breakpoint; it
 * always steps down to one column on a phone (§4.17).
 */
export function CardGrid({
  children,
  columns = 3,
  className,
}: {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  const layouts = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={cn('grid grid-cols-1 gap-5 sm:gap-6', layouts[columns], className)}>
      {children}
    </div>
  )
}

/**
 * The interior-page hero — near-black, display type, an accent phrase.
 *
 * Shared rather than rewritten per page so every section of the site opens the
 * same way, which is what makes the reference site read as one thing. The
 * headline splits into `title` plus an optional `accent` so the emphasis
 * lands inside the sentence rather than on a separate line.
 */
export function PageHero({
  eyebrow,
  title,
  accent,
  lead,
  children,
}: {
  eyebrow?: string
  title: string
  accent?: string
  lead?: string
  children?: ReactNode
}) {
  return (
    <section className="bg-ink-950 text-white">
      <Container size="wide" className="py-14 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          {eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-widest text-gold-400">
              {eyebrow}
            </p>
          )}

          <h1 className="mt-6 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
            {title}
            {accent && <span className="text-gold-400"> {accent}</span>}
          </h1>

          {lead && (
            <p className="mt-8 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
              {lead}
            </p>
          )}

          {children && (
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {children}
            </div>
          )}
        </div>
      </Container>
    </section>
  )
}

/** Full-width call-to-action band (§4.3 "CTA band"). */
export function CtaBand({
  title,
  lead,
  children,
  tone = 'forest',
}: {
  title: string
  lead?: string
  children?: ReactNode
  tone?: 'forest' | 'harbour' | 'ink'
}) {
  return (
    <Section tone={tone}>
      <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-2xl sm:text-3xl">{title}</h2>
          {lead && <p className="mt-3 text-white/85 sm:text-lg">{lead}</p>}
        </div>
        {children && (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {children}
          </div>
        )}
      </div>
    </Section>
  )
}

/** Shown wherever a filtered list comes back empty. */
export function EmptyState({
  title,
  message,
  children,
}: {
  title: string
  message?: string
  children?: ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-ink-300 bg-ink-50 px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-ink-900">{title}</p>
      {message && (
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">{message}</p>
      )}
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}

/**
 * Numbered pagination for long listings (§4.11 "results as cards with
 * pagination").
 *
 * Every page is a real address, and every control is a link rather than a
 * button: page three of the agriculture filter is something a member can
 * bookmark and paste into an email, the back button behaves the way the reader
 * expects, and the whole thing works before hydration (NFR-01).
 *
 * The caller supplies `hrefFor` rather than a base URL, because each listing
 * carries a different set of filters that have to survive the page change —
 * only the caller knows what they are.
 */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number
  pageCount: number
  hrefFor: (page: number) => string
}) {
  if (pageCount <= 1) return null

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1)

  return (
    <nav aria-label="Pagination" className="mt-12 flex justify-center">
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          <PageLink
            href={hrefFor(page - 1)}
            disabled={page === 1}
            label="Previous page"
          >
            <Icon name="chevronRight" className="size-4 rotate-180" />
          </PageLink>
        </li>

        {pages.map((n) => (
          <li key={n}>
            <PageLink href={hrefFor(n)} current={n === page} label={`Page ${n}`}>
              {n}
            </PageLink>
          </li>
        ))}

        <li>
          <PageLink
            href={hrefFor(page + 1)}
            disabled={page === pageCount}
            label="Next page"
          >
            <Icon name="chevronRight" className="size-4" />
          </PageLink>
        </li>
      </ul>
    </nav>
  )
}

/**
 * One pagination control.
 *
 * A disabled control renders as a <span>, not a dimmed link: a link to the
 * page before the first page is a dead control, and removing it from the tab
 * order is the difference between a keyboard user landing somewhere and
 * landing nowhere (NFR-09). The numeral is visible; the label it needs to be
 * announced with is not.
 */
function PageLink({
  href,
  children,
  current,
  disabled,
  label,
}: {
  href: string
  children: ReactNode
  current?: boolean
  disabled?: boolean
  label: string
}) {
  const classes = cn(
    'inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg px-3 text-sm font-medium',
    current
      ? 'bg-forest-600 text-white'
      : 'text-ink-700 ring-1 ring-inset ring-ink-300 hover:ring-forest-400',
  )

  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={cn(classes, 'cursor-not-allowed opacity-40')}
      >
        {children}
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={classes}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Link>
  )
}
