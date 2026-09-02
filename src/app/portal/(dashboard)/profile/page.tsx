import type { Metadata } from 'next'

import { ChangePasswordForm } from '@/components/site/password-forms'
import { ProfileForm } from '@/components/site/profile-form'
import { Card } from '@/components/ui/card'
import { db } from '@/lib/db'
import { ROLE_LABELS } from '@/lib/enums'
import { requireUser } from '@/lib/rbac'

/**
 * My details (§4.16).
 *
 * Two cards, because they are two different kinds of change: correcting a
 * phone number is routine, and changing a password ends every other session.
 * Putting them in one form would make the second happen by accident.
 */

export const metadata: Metadata = {
  title: 'My details',
}

export default async function PortalProfilePage() {
  const user = await requireUser({ redirectTo: '/portal/profile' })

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      country: true,
      email: true,
      createdAt: true,
    },
  })

  if (!row) {
    // The session resolved a user that has since been deleted. Guard rather
    // than render a form that would write to nothing.
    return null
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          My details
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          What the forum has on file for you, and the password you sign in with.
        </p>
      </header>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Your details
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Signed in as {ROLE_LABELS[user.role] ?? user.role}.
        </p>

        <div className="mt-6">
          <ProfileForm
            defaults={{
              firstName: row.firstName,
              lastName: row.lastName,
              phone: row.phone,
              country: row.country,
            }}
            email={row.email}
          />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Password
        </h2>
        <p className="mt-1 text-sm text-ink-600">
          Use something you have not used on another site.
        </p>

        <div className="mt-6">
          <ChangePasswordForm />
        </div>
      </Card>
    </div>
  )
}
