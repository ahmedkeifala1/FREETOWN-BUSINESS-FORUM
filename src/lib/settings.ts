import 'server-only'

import { cache } from 'react'

import { db } from '@/lib/db'

/**
 * Site-wide settings and the current event.
 *
 * The header, footer and hero on every page need the same handful of rows.
 * Each accessor is wrapped in React's `cache`, so a page that renders the
 * header, a hero and a footer makes one query for settings and one for the
 * event rather than three of each.
 *
 * Every read has a fallback. A missing settings row must never blank out the
 * footer or throw — the site has to render even against a partially seeded
 * database (FR-01: pages are generated from the database, but the chrome
 * cannot be hostage to it).
 */

export type SiteSettings = Record<string, string>

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const rows = await db.siteSetting.findMany({
    select: { key: true, value: true },
  })

  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
})

/** Read one setting with a fallback. */
export async function getSetting(
  key: string,
  fallback = '',
): Promise<string> {
  const settings = await getSettings()
  return settings[key] || fallback
}

export const DEFAULT_SETTINGS: SiteSettings = {
  'site.name': 'Freetown Business Forum',
  'site.tagline':
    'Convening capital, government and enterprise for a prosperous Sierra Leone',
  'contact.email': 'freetownbusinessforum@gmail.com',
  'contact.phone': '+232 75 768996',
  'contact.address': 'Freetown Business Forum, 12C Lumley Road, Freetown, Sierra Leone',
  'home.heroStatement': 'Delivering ideas that',
  'home.heroWords': 'Inspire,Excite,Motivate',
  'home.introHeading': 'We *connect* Sierra Leonean enterprise with the world',
  'home.introBody':
    'The Freetown Business Forum brings investors, government and enterprise ' +
    'into one room. Our bi-annual forum, the national business directory and ' +
    'the Deal Room give members a standing route to capital, partners and ' +
    "policy — and give the world a way in to Sierra Leone's fastest-growing " +
    'sectors.',
}

export function setting(
  settings: SiteSettings,
  key: string,
  fallback?: string,
): string {
  return settings[key] || DEFAULT_SETTINGS[key] || fallback || ''
}

/**
 * The forum currently being promoted — the one flagged `isCurrent`.
 *
 * Falls back to the next published event by date if no row carries the flag,
 * so an administrator who forgets to tick it gets a slightly wrong event
 * rather than a site with no event at all.
 */
export const getCurrentEvent = cache(async () => {
  const current = await db.event.findFirst({
    where: { isCurrent: true, isPublished: true },
  })

  if (current) return current

  return db.event.findFirst({
    where: { isPublished: true, endDate: { gte: new Date() } },
    orderBy: { startDate: 'asc' },
  })
})

export type CurrentEvent = NonNullable<
  Awaited<ReturnType<typeof getCurrentEvent>>
>

/** Sectors for the homepage grid, directory filters and deal room filters. */
export const getSectors = cache(async () =>
  db.sector.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: 'asc' },
  }),
)

/** A CMS page body, parsed. Route files own the layout; this owns the copy. */
export const getPageBlocks = cache(
  async (slug: string): Promise<Record<string, string>> => {
    const page = await db.page.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: { bodyJson: true },
    })

    if (!page) return {}

    try {
      const parsed = JSON.parse(page.bodyJson) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>
      }
      return {}
    } catch {
      return {}
    }
  },
)

export const getPage = cache(async (slug: string) =>
  db.page.findFirst({ where: { slug, status: 'PUBLISHED' } }),
)
