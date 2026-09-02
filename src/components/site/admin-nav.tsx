'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/cn'
import { isActivePath } from '@/components/site/nav'

/**
 * Admin navigation (§12).
 *
 * The items are chosen on the server from the signed-in role's permissions and
 * passed in already filtered — an editor never receives the finance links, so
 * they are not in the HTML at all. That is tidiness rather than security: every
 * page behind these links calls its own guard, because a link that is merely
 * absent is still reachable by typing the address.
 *
 * Grouped, because the panel has more sections than a flat list stays readable
 * at, and the groups match how the work divides between the roles.
 */

export type AdminNavGroup = {
  heading: string
  items: { label: string; href: string }[]
}

export function AdminNav({ groups }: { groups: AdminNavGroup[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Admin" className="space-y-6">
      {groups.map((group) => (
        <div key={group.heading}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-ink-500">
            {group.heading}
          </p>

          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              // The dashboard is the ancestor of every admin page, so an
              // ancestor match would light it up on all of them.
              const active =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : isActivePath(pathname, item.href)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-forest-50 text-forest-800'
                        : 'text-ink-700 hover:bg-ink-100 hover:text-ink-950',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
