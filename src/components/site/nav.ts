/**
 * The sitemap, in one place.
 *
 * The header, the mobile drawer and the footer all read from here, so a new
 * page is added to the navigation once rather than three times and they cannot
 * drift apart.
 *
 * The six top-level items and their order follow the reference site
 * (londonbusinessforum.com). Where the forum has content the reference has no
 * name for, it is nested rather than dropped:
 *
 *  - the Deal Room and the business directory sit under Events and Membership,
 *    because that is where a visitor is when they need them;
 *  - Learning Hub — the reference's on-demand library — carries the forum's
 *    sector guides, the doing-business guide and the downloads, which is the
 *    same job done with the material this forum actually has.
 */

export type NavItem = {
  label: string
  href: string
  children?: NavItem[]
}

export const MAIN_NAV: NavItem[] = [
  {
    label: 'Membership',
    href: '/membership',
    children: [
      { label: 'Why join', href: '/membership' },
      { label: 'Tiers & pricing', href: '/membership/tiers' },
      { label: 'Apply or renew', href: '/membership/apply' },
      { label: 'Business directory', href: '/directory' },
    ],
  },
  {
    label: 'Events',
    href: '/events',
    children: [
      { label: 'Overview & theme', href: '/events' },
      { label: 'Agenda', href: '/events/agenda' },
      { label: 'Speakers', href: '/events/speakers' },
      { label: 'Deal Room', href: '/deal-room' },
      { label: 'Sponsors & exhibitors', href: '/events/sponsors' },
      { label: 'Venue & travel', href: '/events/venue' },
      { label: 'Register', href: '/register' },
    ],
  },
  {
    label: 'Learning Hub',
    href: '/learning-hub',
    children: [
      { label: 'Sector guides', href: '/learning-hub/sectors' },
      { label: 'Doing business guide', href: '/learning-hub/doing-business' },
      { label: 'Reports & downloads', href: '/learning-hub/downloads' },
      { label: 'Session recordings', href: '/learning-hub/recordings' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    children: [
      { label: 'Vision & mandate', href: '/about' },
      { label: 'Leadership', href: '/about/leadership' },
      { label: 'Governance', href: '/about/governance' },
      { label: 'Partners', href: '/about/partners' },
    ],
  },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Blog', href: '/blog' },
]

export const FOOTER_NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Events',
    items: [
      { label: 'Overview & theme', href: '/events' },
      { label: 'Agenda', href: '/events/agenda' },
      { label: 'Speakers', href: '/events/speakers' },
      { label: 'Sponsors', href: '/events/sponsors' },
      { label: 'Venue & travel', href: '/events/venue' },
      { label: 'Register', href: '/register' },
    ],
  },
  {
    heading: 'Membership',
    items: [
      { label: 'Why join', href: '/membership' },
      { label: 'Tiers & pricing', href: '/membership/tiers' },
      { label: 'Apply or renew', href: '/membership/apply' },
      { label: 'Business directory', href: '/directory' },
    ],
  },
  {
    heading: 'Learning Hub',
    items: [
      { label: 'Sector guides', href: '/learning-hub/sectors' },
      { label: 'Doing business guide', href: '/learning-hub/doing-business' },
      { label: 'Reports & downloads', href: '/learning-hub/downloads' },
      { label: 'Deal Room', href: '/deal-room' },
    ],
  },
  {
    heading: 'About',
    items: [
      { label: 'Vision & mandate', href: '/about' },
      { label: 'Leadership', href: '/about/leadership' },
      { label: 'Partners', href: '/about/partners' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
]

export const LEGAL_NAV: NavItem[] = [
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Terms & conditions', href: '/terms' },
]

/** True when `href` is the current page or an ancestor of it. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
