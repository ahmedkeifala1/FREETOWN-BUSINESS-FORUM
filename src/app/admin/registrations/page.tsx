import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import { RegistrationStatus } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Registrations (§4.9, FR-05, §12).
 *
 * Search is by reference, name, organisation or email, because those are the
 * four things a delegate on the phone can actually tell you. It is a GET form
 * so a search is a shareable address and the back button works.
 *
 * Matching is done with `contains` rather than a full-text index: the volume is
 * a few thousand rows for one annual forum, and an index that has to be kept in
 * step is machinery this does not need yet.
 */

export const metadata: Metadata = {
  title: 'Registrations',
}

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Confirmed', value: RegistrationStatus.CONFIRMED },
  { label: 'Pending', value: RegistrationStatus.PENDING },
  { label: 'Cancelled', value: RegistrationStatus.CANCELLED },
  { label: 'Refunded', value: RegistrationStatus.REFUNDED },
]

export default async function AdminRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await requirePermission(Permission.REGISTRATION_VIEW, {
    redirectTo: '/admin/registrations',
  })

  const { status, q } = await searchParams

  const active = FILTERS.find((f) => f.value && f.value === status)?.value
  const query = (q ?? '').trim()

  const registrations = await db.registration.findMany({
    where: {
      ...(active ? { status: active } : {}),
      // `mode: 'insensitive'` is not decoration: Postgres `LIKE` is
      // case-sensitive, so without it a search for "sesay" would miss every
      // row stored as "Sesay" — which is all of them. Nobody types a
      // reference or a surname in the case it was recorded in.
      ...(query
        ? {
            OR: [
              { reference: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
              { organisation: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      reference: true,
      firstName: true,
      lastName: true,
      email: true,
      organisation: true,
      status: true,
      quantity: true,
      currency: true,
      totalMinor: true,
      createdAt: true,
      ticketType: { select: { name: true } },
      event: { select: { name: true } },
      _count: { select: { delegates: true } },
    },
  })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Registrations
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Every booking for the forum, newest first.
        </p>
      </header>

      {/* ── Search ──────────────────────────────────────────────────────── */}

      <form action="/admin/registrations" className="flex flex-wrap gap-3">
        {active && <input type="hidden" name="status" value={active} />}

        <label htmlFor="q" className="sr-only">
          Search registrations
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Reference, name, organisation or email"
          className="min-h-11 flex-1 rounded-lg border border-ink-300 bg-white px-3.5 py-2.5 text-base text-ink-950 placeholder:text-ink-400 focus:border-forest-600"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-lg bg-forest-600 px-5 text-sm font-medium text-white hover:bg-forest-700"
        >
          Search
        </button>
      </form>

      {/* ── Filters ─────────────────────────────────────────────────────── */}

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const isCurrent = (active ?? '') === filter.value
            const href = new URLSearchParams()
            if (filter.value) href.set('status', filter.value)
            if (query) href.set('q', query)
            const search = href.toString()

            return (
              <li key={filter.label}>
                <Link
                  href={`/admin/registrations${search ? `?${search}` : ''}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium transition-colors',
                    isCurrent
                      ? 'bg-forest-600 text-white'
                      : 'border border-ink-300 bg-white text-ink-700 hover:border-forest-500 hover:text-forest-700',
                  )}
                >
                  {filter.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* ── Results ─────────────────────────────────────────────────────── */}

      {registrations.length === 0 ? (
        <EmptyState
          title="Nothing found"
          message={
            query
              ? `No registration matches “${query}”. Check the spelling, or try just the reference.`
              : 'No registrations have that status yet.'
          }
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {registrations.map((registration) => (
              <li key={registration.id}>
                <Link
                  href={`/admin/registrations/${registration.reference}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-950">
                      {registration.firstName} {registration.lastName}
                      {registration.organisation && (
                        <span className="font-normal text-ink-600">
                          {' '}
                          — {registration.organisation}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-600">
                      <span className="font-mono">{registration.reference}</span>
                      {' · '}
                      {registration.ticketType.name}
                      {' · '}
                      {registration._count.delegates || registration.quantity}{' '}
                      {(registration._count.delegates ||
                        registration.quantity) === 1
                        ? 'delegate'
                        : 'delegates'}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {isCurrency(registration.currency)
                        ? formatMoney(
                            registration.totalMinor,
                            registration.currency,
                          )
                        : registration.totalMinor}
                      {' · '}
                      {formatDate(registration.createdAt)}
                    </p>
                  </div>

                  <StatusBadge status={registration.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {registrations.length === 200 && (
        <p className="text-sm text-ink-600">
          Showing the most recent 200. Narrow it with the search box above.
        </p>
      )}
    </div>
  )
}
