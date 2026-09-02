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

// The events listing writes the year out as well: a programme published a year
// ahead is read by people deciding between two diaries, and "Tuesday 12 May"
// alone makes them go and check which May it is.
const weekdayFull = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
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
export const formatWeekdayFull = (date: Date) => weekdayFull.format(date)
export const formatTime = (date: Date) => timeOnly.format(date)

export const formatTimeRange = (start: Date, end: Date) =>
  `${timeOnly.format(start)} – ${timeOnly.format(end)}`

/**
 * How long a session runs, written the way a listing writes it: "1h 30mins".
 *
 * The events list shows this beside the start time so a reader can see what a
 * session costs them without doing the subtraction, which is what the
 * reference site does. Minutes are kept plural-correct because a 45mins break
 * and a 1min overrun both appear in a seeded programme.
 */
export function formatDuration(start: Date, end: Date): string {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const mins = `${rest}min${rest === 1 ? '' : 's'}`

  if (hours === 0) return mins
  if (rest === 0) return `${hours}h`
  return `${hours}h ${mins}`
}

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
 * A stored date as the value of a `datetime-local` input.
 *
 * The browser control carries no time zone: the string it is handed is the
 * string it shows and the string it submits back. Slicing the ISO form keeps
 * it in the same UTC everything above renders in, so an event manager editing
 * a session sees the time the agenda is showing rather than that time shifted
 * into whatever zone the machine happens to sit in. `utcDateTimeSchema` in
 * lib/validation is the other half of this and must not drift from it.
 */
export const toDateTimeInput = (date: Date) => date.toISOString().slice(0, 16)

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

/**
 * A file size, written the way a download link should say it.
 *
 * Rounded to whole units above a megabyte and one decimal below, because
 * "2.4 MB" is the number someone on a metered connection is deciding on and
 * "2,411,724 bytes" is not. Decimal units, not binary — a browser's download
 * panel says MB meaning 10^6, and disagreeing with it helps nobody.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return ''

  const units = ['bytes', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0

  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }

  const decimals = unit === 0 ? 0 : value < 10 ? 1 : 0
  return `${value.toFixed(decimals)} ${units[unit]}`
}

/**
 * A short label for a file, from its MIME type — "PDF", "Word", "Excel".
 *
 * Taken from the MIME type rather than the filename extension: the extension
 * is whatever the uploader's machine happened to put there, and a mislabelled
 * link ("XLSX" on a PDF) is exactly the sort of small wrongness that makes a
 * download feel unsafe to click.
 */
export function fileKindLabel(mimeType: string): string {
  const known: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'Word',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.ms-powerpoint': 'Slides',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      'Slides',
    'application/zip': 'ZIP',
    'text/csv': 'CSV',
  }

  if (known[mimeType]) return known[mimeType]
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.startsWith('video/')) return 'Video'
  if (mimeType.startsWith('audio/')) return 'Audio'

  return 'File'
}
