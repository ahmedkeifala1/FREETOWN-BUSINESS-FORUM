import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import { MemberStatus } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Members (FR-09, §12).
 *
 * The default view is everything, ordered with the pending applications first,
 * because an application nobody has looked at is the only row on this screen
 * with somebody waiting at the other end of it. The status filter is a set of
 * links rather than a form: each view is a real address that staff can bookmark
 * and send to a colleague.
 */

export const metadata: Metadata = {
  title: 'Members',
}

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: MemberStatus.PENDING },
  { label: 'Active', value: MemberStatus.ACTIVE },
  { label: 'Expired', value: MemberStatus.EXPIRED },
  { label: 'Suspended', value: MemberStatus.SUSPENDED },
  { label: 'Cancelled', value: MemberStatus.CANCELLED },
]

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requirePermission(Permission.MEMBERSHIP_VIEW, {
    redirectTo: '/admin/members',
  })

  const { status } = await searchParams

  // Only a status we recognise ever reaches the query.
  const active = FILTERS.find((f) => f.value && f.value === status)?.value

  const members = await db.member.findMany({
    where: active ? { status: active } : undefined,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      memberNo: true,
      organisationName: true,
      status: true,
      createdAt: true,
      expiresAt: true,
      tier: { select: { name: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
      listing: { select: { isPublished: true } },
    },
  })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Members
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Applications to vet, memberships to renew, and everyone currently on
          the register.
        </p>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const isCurrent = (active ?? '') === filter.value

            return (
              <li key={filter.label}>
                <Link
                  href={
                    filter.value
                      ? `/admin/members?status=${filter.value}`
                      : '/admin/members'
                  }
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

      {/* ── The register ────────────────────────────────────────────────── */}

      {members.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message={
            active
              ? 'No membership currently has that status.'
              : 'No applications have been received yet.'
          }
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {members.map((member) => (
              <li key={member.id}>
                <Link
                  href={`/admin/members/${member.memberNo}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink-950">
                      {member.organisationName}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-600">
                      <span className="font-mono">{member.memberNo}</span>
                      {' · '}
                      {member.tier.name}
                      {' · '}
                      {member.user.firstName} {member.user.lastName}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {member.status === MemberStatus.PENDING
                        ? `Applied ${formatDate(member.createdAt)}`
                        : member.expiresAt
                          ? `Runs until ${formatDate(member.expiresAt)}`
                          : `Joined ${formatDate(member.createdAt)}`}
                      {member.listing?.isPublished && ' · listed'}
                    </p>
                  </div>

                  <StatusBadge status={member.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
