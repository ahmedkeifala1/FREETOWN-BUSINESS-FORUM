'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'
import { isActivePath } from '@/components/site/nav'

/**
 * The portal's own navigation (§4.16).
 *
 * Which items exist is decided on the server and passed in — a member sees the
 * membership and directory sections, a delegate does not. That is presentation
 * only: every page behind these links re-checks for itself, because hiding a
 * link is not access control (§12).
 *
 * It renders as a sidebar on a wide screen and a horizontal scroller above the
 * content on a phone, which keeps the current section visible without stealing
 * a screenful of height from it (§4.17).
 */

export type PortalNavItem = {
  label: string
  href: string
  icon: 'user' | 'ticket' | 'users' | 'building' | 'document'
}

export function PortalNav({ items }: { items: PortalNavItem[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Portal" className="lg:sticky lg:top-24">
      <ul
        className={cn(
          'flex gap-1 overflow-x-auto pb-2',
          'lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0',
        )}
      >
        {items.map((item) => {
          // The dashboard is only active on an exact match — otherwise, as the
          // ancestor of every other portal page, it would light up on all of
          // them.
          const active =
            item.href === '/portal'
              ? pathname === '/portal'
              : isActivePath(pathname, item.href)

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-forest-50 text-forest-800'
                    : 'text-ink-700 hover:bg-ink-100 hover:text-ink-950',
                )}
              >
                <Icon
                  name={item.icon}
                  className={cn(
                    'size-4 shrink-0',
                    active ? 'text-forest-700' : 'text-ink-400',
                  )}
                />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
