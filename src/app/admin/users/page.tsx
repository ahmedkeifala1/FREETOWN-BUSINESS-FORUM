import type { Metadata } from 'next'

import { UserAccessForm } from '@/components/site/user-access-form'
import { Badge, Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { ROLE_LABELS, Role } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { Permission, requirePermission, STAFF_ROLES } from '@/lib/rbac'

/**
 * Users (§12, FR-04).
 *
 * Staff first, then everybody else, because this screen exists to manage who
 * can get into the panel — a list led by four hundred delegates buries the
 * six accounts that carry real power.
 *
 * There is no "create user" here. Staff accounts are seeded or promoted from an
 * existing account, and member accounts are created by the membership flow.
 * A form that mints an account with a password chosen by somebody else is how
 * shared logins start.
 */

export const metadata: Metadata = {
  title: 'Users',
}

export default async function AdminUsersPage() {
  const current = await requirePermission(Permission.USER_MANAGE, {
    redirectTo: '/admin/users',
  })

  const [staff, others] = await Promise.all([
    db.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    db.user.findMany({
      where: { role: { notIn: STAFF_ROLES } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
  ])

  const sections = [
    { heading: 'Staff', users: staff, manageable: true },
    { heading: 'Members and delegates', users: others, manageable: true },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">Users</h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Who can sign in, and what they may do. Every change here is written to
          the audit log.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.heading} className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink-950">
            {section.heading}
          </h2>

          {section.users.length === 0 ? (
            <EmptyState title="Nobody here" />
          ) : (
            <ul className="space-y-3">
              {section.users.map((user) => (
                <li key={user.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-ink-950">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-ink-600">
                          {user.email}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-500">
                          {user.lastLoginAt
                            ? `Last signed in ${formatDate(user.lastLoginAt)}`
                            : 'Never signed in'}
                          {' · '}
                          joined {formatDate(user.createdAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Badge
                          tone={
                            user.role === Role.ADMIN ? 'gold' : 'neutral'
                          }
                        >
                          {ROLE_LABELS[user.role as Role] ?? user.role}
                        </Badge>
                        {!user.isActive && (
                          <Badge tone="danger">Disabled</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 border-t border-ink-100 pt-5">
                      <UserAccessForm
                        userId={user.id}
                        role={user.role}
                        isActive={user.isActive}
                        isSelf={user.id === current.id}
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {others.length === 100 && (
        <p className="text-sm text-ink-600">
          Showing the 100 most recent non-staff accounts.
        </p>
      )}
    </div>
  )
}
