import type { Metadata } from 'next'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * The audit trail (§14, FR-14).
 *
 * Read-only, and there is no filter that can hide a row — the value of a trail
 * is that it is complete, and a screen offering to exclude entries is a screen
 * that invites someone to look away from them. It is paged rather than
 * searchable for the same reason: the question this answers is "what happened",
 * not "show me only the answer I want".
 */

export const metadata: Metadata = {
  title: 'Audit log',
}

const PAGE_SIZE = 100

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requirePermission(Permission.AUDIT_VIEW, { redirectTo: '/admin/audit' })

  const { page: rawPage } = await searchParams
  const page = Math.max(1, Number(rawPage) || 1)

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        summary: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    db.auditLog.count(),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Audit log
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Every staff action that moved money, changed an entitlement or
          published something. Append-only — nothing here can be edited or
          removed.
        </p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          message="Actions taken in the admin panel appear here as they happen."
        />
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {entries.map((entry) => (
              <li key={entry.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-wider text-forest-700">
                    {entry.action}
                  </p>
                  <p className="text-xs text-ink-500">
                    {entry.createdAt.toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <p className="mt-1.5 text-sm leading-relaxed text-ink-800">
                  {entry.summary}
                </p>

                <p className="mt-1 text-xs text-ink-500">
                  {entry.user
                    ? `${entry.user.firstName} ${entry.user.lastName} (${entry.user.email})`
                    : 'System'}
                  {entry.ipAddress && ` · ${entry.ipAddress}`}
                  {entry.entityId && ` · ${entry.entityType} ${entry.entityId}`}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Audit log pages"
          className="flex items-center justify-between gap-4 text-sm"
        >
          {page > 1 ? (
            <a
              href={`/admin/audit?page=${page - 1}`}
              className="font-medium text-forest-700 hover:underline"
            >
              Newer
            </a>
          ) : (
            <span />
          )}

          <span className="text-ink-600">
            Page {page} of {pageCount}
          </span>

          {page < pageCount ? (
            <a
              href={`/admin/audit?page=${page + 1}`}
              className="font-medium text-forest-700 hover:underline"
            >
              Older
            </a>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
