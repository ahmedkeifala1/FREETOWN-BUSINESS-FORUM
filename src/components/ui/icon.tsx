import type { SVGProps } from 'react'

/**
 * Inline line icons (§3.4 "simple line icons for sectors, benefits and steps").
 *
 * Hand-drawn paths rather than an icon package: the site needs about twenty
 * icons, and every icon library ships thousands. Inlined here they add roughly
 * 2KB to the bundle, cost no extra request, and inherit `currentColor` so a
 * single component works on both light and dark section tones.
 *
 * Icon keys match the `iconKey` column on Sector, so the secretariat can change
 * a sector's icon from the admin panel by typing a key from this list.
 */

const paths: Record<string, string> = {
  // Sectors
  sprout:
    'M12 21v-8m0 0C12 9 9 6 4 6c0 5 3 7 8 7Zm0 0c0-4 3-7 8-7 0 5-3 7-8 7Z',
  pickaxe:
    'M14 10 4 20m10-10 3.5-3.5M14 10l-4-4m4 4 4 4m-7.5-7.5C8 4 5.5 3 3 3c0 2.5 1 5 3.5 6.5m10 1C19 13 20 15.5 20 18c-2.5 0-5-1-6.5-3.5',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  palm: 'M12 22V10m0 0c0-3 2-6 6-6 0 3-2.5 5-6 6Zm0 0c0-3-2-6-6-6 0 3 2.5 5 6 6Zm0 0c2-2 5-3 8-2-1.5 2.5-4.5 3.5-8 2Zm0 0c-2-2-5-3-8-2 1.5 2.5 4.5 3.5 8 2Z',
  smartphone:
    'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm4 15h2',
  road: 'M4 21 8 3m12 18-4-18m-4 2v3m0 4v3m0 4v3',
  fish: 'M3 12c3-4.5 7-6.5 11-6.5 3 0 5.5 1.5 7 3.5-1.5 2-4 3.5-7 3.5m-11-.5c3 4.5 7 6.5 11 6.5 3 0 5.5-1.5 7-3.5M6 12h.01',
  factory:
    'M3 21V9l6 4V9l6 4V4h6v17H3Zm4-4h2m4 0h2m4 0h.01',
  briefcase:
    'M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm5 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M3 13h18',

  // Audience and benefits
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  building:
    'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M4 21h17M8 8h3m-3 4h3m-3 4h3m5 0h1',
  handshake:
    'm11 17 2 2a1 1 0 0 0 1.5-.1l3.5-4M3 10l4-4 4 3 3-1 6 5-3 4-4-3-3 2-4-3-3-3Z',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.5 3.5-5.5 3.5-9S14.5 5.5 12 3m0 18c-2.5-2.5-3.5-5.5-3.5-9S9.5 5.5 12 3M3.5 9h17m-17 6h17',
  trending:
    'm3 17 6-6 4 4 8-8m0 0h-5m5 0v5',
  target:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  shield:
    'M12 3 4 6v6c0 4.5 3.2 8.3 8 9 4.8-.7 8-4.5 8-9V6l-8-3Zm-2.5 9 2 2 4-4',

  // Interface
  calendar:
    'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3-2v4m8-4v4M4 10h16',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
  pin: 'M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 1.5 9 6.5 9-6.5',
  phone:
    'M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2',
  arrowRight: 'M4 12h15m0 0-6-6m6 6-6 6',
  check: 'm4 12 5 5L20 6',
  chevronDown: 'm6 9 6 6 6-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6 18 18M18 6 6 18',
  ticket:
    'M4 8a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V8Zm10-1v10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
  document:
    'M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6m-6 4h6',
  quote:
    'M10 7c-3 1-5 3.5-5 7 0 2.2 1.4 3.5 3 3.5S11 16.2 11 14.5 9.8 11.5 8.5 11.5c-.6 0-1 .1-1.4.3M20 7c-3 1-5 3.5-5 7 0 2.2 1.4 3.5 3 3.5s3-1.3 3-3c0-1.7-1.2-3-2.5-3-.6 0-1 .1-1.4.3',
  chevronRight: 'm9 6 6 6-6 6',
}

export type IconName = keyof typeof paths

export function Icon({
  name,
  className = 'size-6',
  ...props
}: { name: string; className?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  // An unknown key from the CMS falls back to the generic icon rather than
  // rendering an empty box.
  const d = paths[name] ?? paths.briefcase

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default — the label always sits in adjacent text.
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={d} />
    </svg>
  )
}
