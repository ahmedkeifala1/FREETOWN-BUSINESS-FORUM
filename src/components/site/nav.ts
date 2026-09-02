/**
 * The sitemap, in one place.
 *
 * The header, the mobile drawer and the footer all read from here, so a new
 * page is added to the navigation once rather than three times and they cannot
 * drift apart.
 *
 * The six top-level items and their order follow the reference site
 * (londonbusinessforum.com), and so does the shape of the list: it is flat.
 * Every item in the header is a link to a page, and no item opens a menu.
 *
 *  - Events, Membership, Learning Hub and About are plain links rather than
 *    menus, at the secretariat's request. Their inner pages — the agenda, the
 *    speakers, the sponsors and the venue; the tiers and the application; the
 *    sector guides, the doing-business guide, the downloads and the
 *    recordings; leadership, governance and partners — are reached from the
 *    section's own landing page and from its footer column;
 *  - the Deal Room therefore has no place in the header. It is reached from
 *    the homepage, from the footer and from the portal's membership page;
 *  - Learning Hub — the reference's on-demand library — carries the forum's
 *    sector guides, the doing-business guide and the downloads, which is the
 *    same job done with the material this forum actually has.
 *
 * A flat sitemap is why `NavItem` has no `children`. Adding one back would
 * mean the dropdown as well: the header renders what this file describes, and
 * a nested item it could not render would be a page silently missing from the
 * navigation.
 */

export type NavItem = {
  label: string
  href: string
}

export const MAIN_NAV: NavItem[] = [
  { label: 'Membership', href: '/membership' },
  { label: 'Events', href: '/events' },
  { label: 'Learning Hub', href: '/learning-hub' },
  { label: 'About', href: '/about' },
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
      // Governance was reachable from the header menu and nowhere else in the
      // chrome. With the menu gone it takes the place in this column that the
      // other three About pages already had.
      { label: 'Governance', href: '/about/governance' },
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
