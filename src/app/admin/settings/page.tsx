import type { Metadata } from 'next'

import { SettingsForm } from '@/components/site/settings-form'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Site settings (§15).
 *
 * The rows are the vocabulary — the form is generated from whatever the table
 * holds — so adding a setting is a migration and a seed line, not a change
 * here.
 */

export const metadata: Metadata = {
  title: 'Settings',
}

export default async function AdminSettingsPage() {
  await requirePermission(Permission.SETTINGS_MANAGE, {
    redirectTo: '/admin/settings',
  })

  const settings = await db.siteSetting.findMany({
    orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    select: {
      key: true,
      value: true,
      label: true,
      type: true,
      group: true,
    },
  })

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Settings
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          The site name, contact details and the copy that appears in the header
          and footer of every page.
        </p>
      </header>

      {settings.length === 0 ? (
        <EmptyState
          title="No settings yet"
          message="Run the seed to load the default settings."
        />
      ) : (
        <Card>
          <SettingsForm settings={settings} />
        </Card>
      )}

      <div className="flex gap-3 rounded-xl bg-ink-50 p-5">
        <Icon name="shield" className="mt-0.5 size-5 shrink-0 text-ink-500" />
        <p className="text-sm leading-relaxed text-ink-600">
          These values appear on every page of the public site. Every change is
          recorded in the audit log against your name.
        </p>
      </div>
    </div>
  )
}
