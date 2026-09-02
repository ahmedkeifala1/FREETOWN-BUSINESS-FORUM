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
 * One bar: logo left, the six links through the middle, and search, login and
 * the enquiry button at the right-hand end, in the reference's order and with
 * its proportions — a tall bar (96px on a wide screen), wide air between the
 * links, unbolded labels at 15px with the letter-spacing opened up, and a
 * hairline that grows under a label on hover and stays out on the current
 * page.
 *
 * It stays near-black at every width, where the reference is dark only on its
 * landing template and white with a shadow on interior pages: most interior
 * pages here open on a near-black `PageHero`, which a white bar would meet as
 * a seam. The mark sits on it transparently, in its own colours (see
 * `site/logo`). The accent under the
 * links and on hover is gold rather than the reference's red because the
 * palette is ours (§3.2); the composition is what is being followed, not the
 * brand.
 *
 * The enquiry button stays visible at every width — on a phone it sits beside
 * the hamburger rather than inside the drawer, because the brief calls for
 * registration-first design and a CTA hidden behind a menu is not that.
 *
 * Every item in the bar is a plain link. The reference site has no menu in its
 * header and neither does this one: About used to open a four-item dropdown,
 * and it now goes straight to the About page, which carries the routes into
 * leadership, governance and partners itself. A menu that has to be hovered
 * costs a visitor on a touch screen an extra tap to reach the very page the
 * word names, and the section landing pages do the job without that.
 *
 * Only the mobile drawer needs state, which is why this is the one piece of
 * site chrome that ships as a Client Component.
 */

type Props = {
  eventName: string | null
  registrationOpen: boolean
  /** Null when signed out — drives the portal link's label only. */
  userFirstName: string | null
  isStaff: boolean
}

export function Header({
  eventName,
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
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 xl:h-24">
          <Link
            href="/"
            aria-label={`${eventName ?? 'Freetown Business Forum'} — home`}
          >
            <Logo priority size="header" />
          </Link>

          {/* Centred in what the logo and the right-hand cluster leave, rather
              than on the page: the reference centres its nav absolutely and
              lets the two ends overlap it, which it can afford because its bar
              is 1860px wide. Ours is the site's `wide` container, so the links
              are kept in flow where they cannot collide with the enquiry
              button at the narrow end of `xl`. */}
          <nav
            aria-label="Main"
            className="hidden xl:flex xl:flex-1 xl:items-center xl:justify-center xl:gap-8"
          >
            {MAIN_NAV.map((item) => {
              const active = isActivePath(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    // The rule under the label is the reference's: a hairline
                    // that grows from the centre to three-fifths of the word
                    // on hover, and stays out at full width on the page you
                    // are on. It is drawn as a pseudo-element so it takes no
                    // space and the labels never shift.
                    'relative py-2 text-[0.9375rem] tracking-wider transition-colors',
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:mx-auto after:h-px after:bg-gold-400 after:transition-[width] after:content-['']",
                    active
                      ? 'text-gold-400 after:w-3/5'
                      : 'text-white/85 after:w-0 hover:text-gold-400 hover:after:w-3/5',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* 15px between the utilities and 30px before the button, as on the
              reference — the button reads as a separate thing rather than the
              last item in a row. */}
          <div className="flex items-center gap-4">
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
              className="hidden size-10 items-center justify-center text-white/85 hover:text-gold-400 lg:inline-flex"
            >
              <span className="sr-only">Search</span>
              <Icon name="search" className="size-5" />
            </Link>

            {/* Plain text, no icon: the reference pairs one icon — search —
                with a worded login, and a second glyph beside it turned the
                right-hand end into a row of symbols. */}
            <Link
              href="/portal"
              className="hidden text-[0.9375rem] tracking-wider text-white/85 hover:text-gold-400 lg:inline-flex"
            >
              {userFirstName ?? 'Login'}
            </Link>

            {/* The reference site's persistent CTA. Registration keeps its own
                button in the Events section and the homepage hero, so the
                registration-first requirement (§4.9) still holds. */}
            <ButtonLink
              href="/contact"
              variant="accent"
              size="sm"
              className="rounded-none font-semibold uppercase tracking-wider lg:ml-3"
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
      </header>

      {/* Mobile drawer. One row per top-level page, in the order the bar shows
          them — the same flat list, since there are no sections left to
          expand.

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
