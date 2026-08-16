/**
 * Date, time and text formatting.
 *
 * Everything is British English and Freetown-local (NFR-11 "local date/time").
 * Sierra Leone observes GMT year-round with no daylight saving, so a fixed
 * 'UTC' timeZone is correct here and is also what keeps server and browser
 * renders identical — a locale-dependent format would hydrate differently on a
 * delegate's handset than it rendered on the server.
 */

const TZ = 'UTC'

const dateOnly = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: TZ,
})

const dateShort = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TZ,
})

const dayAndMonth = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
})

const weekdayLong = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
})

const timeOnly = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
})

export const formatDate = (date: Date) => dateOnly.format(date)
export const formatDateShort = (date: Date) => dateShort.format(date)
export const formatDayMonth = (date: Date) => dayAndMonth.format(date)
export const formatWeekday = (date: Date) => weekdayLong.format(date)
export const formatTime = (date: Date) => timeOnly.format(date)

export const formatTimeRange = (start: Date, end: Date) =>
  `${timeOnly.format(start)} – ${timeOnly.format(end)}`

/**
 * A date range written the way a person would say it:
 *   18–20 November 2027        (same month)
 *   30 November – 2 December 2027  (spanning months)
 */
export function formatDateRange(start: Date, end: Date): string {
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()

  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${new Intl.DateTimeFormat(
      'en-GB',
      { month: 'long', year: 'numeric', timeZone: TZ },
    ).format(start)}`
  }

  if (sameYear) {
    return `${dayAndMonth.format(start)} – ${dateOnly.format(end)}`
  }

  return `${dateOnly.format(start)} – ${dateOnly.format(end)}`
}

/** ISO date for <time dateTime> and structured data (NFR-10). */
export const isoDate = (date: Date) => date.toISOString()

/**
 * "3 days ago" / "in 2 months", for news lists and dashboards.
 * Falls back to an absolute date beyond a month so nothing reads as vague.
 */
export function formatRelative(date: Date, now = new Date()): string {
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / 86_400_000)

  if (Math.abs(diffDays) > 30) return dateShort.format(date)

  const rtf = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' })

  if (Math.abs(diffDays) >= 1) return rtf.format(diffDays, 'day')

  const diffHours = Math.round(diffMs / 3_600_000)
  if (Math.abs(diffHours) >= 1) return rtf.format(diffHours, 'hour')

  return rtf.format(Math.round(diffMs / 60_000), 'minute')
}

/** Days until the forum opens. Negative once it has started. */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.ceil((date.getTime() - now.getTime()) / 86_400_000)
}

// ── Text ────────────────────────────────────────────────────────────────────

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Split CMS body text on blank lines into paragraphs. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function pluralise(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

/** Safely read a JSON column, returning the fallback rather than throwing. */
export function parseJsonColumn<T>(value: string | null, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}
