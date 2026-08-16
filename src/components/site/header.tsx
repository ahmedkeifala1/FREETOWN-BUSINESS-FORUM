'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Logo } from '@/components/site/logo'
import { MAIN_NAV, isActivePath } from '@/components/site/nav'
import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { cn } from '@/lib/cn'

/**
 * Global header (§3.5, §4.17), built to the composition of the reference site.
 *
 * One near-black bar rather than a utility strip above a white header: the
 * hero below it is near-black too, and a white bar meeting it read as a seam.
 * Login and a square Register button share the right-hand end.
 *
 * Register stays visible at every width — on a phone it sits beside the
 * hamburger rather than inside the drawer, because the brief calls for
 * registration-first design and a CTA hidden behind a menu is not that.
 *
 * The desktop dropdowns are CSS-only (`group-hover` plus `focus-within`), so
 * they work with a keyboard and before JavaScript loads. Only the mobile
 * drawer needs state, which is why this is the one piece of site chrome that
 * ships as a Client Component.
 */

type Props = {
  eventName: string | null
  eventDates: string | null
  registrationOpen: boolean
  /** Null when signed out — drives the portal link's label only. */
  userFirstName: string | null
  isStaff: boolean
}

export function Header({
  eventName,
  eventDates,
  registrationOpen,
  userFirstName,
  isStaff,
}: Props) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // Stop the page behind the drawer scrolling while it is open.
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  return (
    <>
      {/* Keyboard users land here first; the target is in the root layout. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-gold-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 bg-ink-950 text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label={`${eventName ?? 'Freetown Business Forum'} — home`}
          >
            <Logo inverted />
          </Link>

          <nav
            aria-label="Main"
            className="hidden xl:flex xl:items-center xl:gap-1"
          >
            {MAIN_NAV.map((item) => {
              const active = isActivePath(pathname, item.href)

              if (!item.children) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'text-gold-400' : 'text-white/85 hover:text-white',
                    )}
                  >
                    {item.label}
                  </Link>
                )
              }

              return (
                <div key={item.href} className="group relative">
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'text-gold-400' : 'text-white/85 hover:text-white',
                    )}
                  >
                    {item.label}
                    <Icon
                      name="chevronDown"
                      className="size-3.5 text-white/50 transition-transform group-hover:rotate-180"
                    />
                  </Link>

                  <div
                    className={cn(
                      'invisible absolute left-0 top-full z-10 w-60 pt-2 opacity-0 transition',
                      'group-hover:visible group-hover:opacity-100',
                      'group-focus-within:visible group-focus-within:opacity-100',
                    )}
                  >
                    <ul className="border border-white/10 bg-ink-900 py-1.5 shadow-xl">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="block px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            {isStaff && (
              <Link
                href="/admin"
                className="hidden text-sm font-medium text-white/70 hover:text-white xl:block"
              >
                Admin
              </Link>
            )}

            {/* A link to the search page rather than a dialog that pops open
                over the bar: it works before hydration, it is bookmarkable,
                and a query already typed survives a reload. */}
            <Link
              href="/search"
              className="hidden size-10 items-center justify-center text-white/85 hover:text-white lg:inline-flex"
            >
              <span className="sr-only">Search</span>
              <Icon name="search" className="size-5" />
            </Link>

            <Link
              href="/portal"
              className="hidden items-center gap-1.5 text-sm font-medium text-white/85 hover:text-white lg:inline-flex"
            >
              <Icon name="user" className="size-4" />
              {userFirstName ?? 'Login'}
            </Link>

            {/* The reference site's persistent CTA. Registration keeps its own
                button in the Events section and the homepage hero, so the
                registration-first requirement (§4.9) still holds. */}
            <ButtonLink
              href="/contact"
              variant="accent"
              size="sm"
              className="rounded-none font-semibold uppercase tracking-wider"
            >
              <span className="sm:hidden">Enquire</span>
              <span className="hidden sm:inline">Make an enquiry</span>
            </ButtonLink>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className="inline-flex size-11 items-center justify-center text-white hover:bg-white/10 xl:hidden"
            >
              <span className="sr-only">
                {menuOpen ? 'Close menu' : 'Open menu'}
              </span>
              <Icon name={menuOpen ? 'close' : 'menu'} className="size-6" />
            </button>
          </div>
        </div>

        {/* The forum's dates as text rather than an image, for search results
            (NFR-10). Subordinate to the bar above: context, not navigation. */}
        {eventName && eventDates && (
          <p className="hidden border-t border-white/10 bg-ink-900 py-1.5 text-center text-xs text-white/70 lg:block">
            <span className="font-medium text-white">{eventName}</span>
            <span aria-hidden="true" className="mx-2 text-white/30">
              ·
            </span>
            {eventDates}
          </p>
        )}
      </header>

      {/* Mobile drawer. Sections are expanded rather than collapsed: on a phone
          a second tap to reveal four links is friction for no gain.

          Closing on click of any link covers every way out of the drawer, and
          replaces resetting the state from an effect on each navigation — a
          setState in an effect body triggers a second render pass for no
          benefit here. */}
      {menuOpen && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-20 z-30 overflow-y-auto overscroll-contain bg-ink-950 text-white xl:hidden"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setMenuOpen(false)
          }}
        >
          <nav aria-label="Mobile" className="px-4 pb-24 pt-4">
            <ul className="space-y-1">
              {MAIN_NAV.map((item) => (
                <li key={item.href} className="border-b border-white/10 pb-2">
                  <Link
                    href={item.href}
                    className={cn(
                      'block px-3 py-3 font-display font-semibold uppercase tracking-wide',
                      isActivePath(pathname, item.href)
                        ? 'text-gold-400'
                        : 'text-white',
                    )}
                  >
                    {item.label}
                  </Link>

                  {item.children && (
                    <ul className="mt-0.5 space-y-0.5 pl-3">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="block px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-3">
              <ButtonLink
                href="/search"
                size="md"
                fullWidth
                className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
              >
                <Icon name="search" className="size-4" />
                Search
              </ButtonLink>

              <ButtonLink
                href="/portal"
                size="md"
                fullWidth
                className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
              >
                <Icon name="user" className="size-4" />
                {userFirstName ? 'My portal' : 'Login'}
              </ButtonLink>

              {isStaff && (
                <ButtonLink
                  href="/admin"
                  size="md"
                  fullWidth
                  className="rounded-none bg-transparent font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10 hover:text-white"
                >
                  Admin panel
                </ButtonLink>
              )}

              {registrationOpen && (
                <ButtonLink
                  href="/register"
                  variant="accent"
                  size="lg"
                  fullWidth
                  className="rounded-none font-semibold uppercase tracking-wider"
                >
                  Register for the forum
                </ButtonLink>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
