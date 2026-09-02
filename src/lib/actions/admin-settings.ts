'use server'

import { revalidatePath } from 'next/cache'

import { destroyAllSessionsFor } from '@/lib/auth'
import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import { ROLE_LABELS, Role } from '@/lib/enums'
import { assertPermission, isStaff, Permission } from '@/lib/rbac'
import { roleSchema } from '@/lib/validation'
import {
  errorState,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Users and site settings (§12, §15).
 *
 * The two administrator-only jobs that change how the rest of the system
 * behaves, so both are audited and both have a guard rail against the mistake
 * that has no undo.
 */

// ── Users ───────────────────────────────────────────────────────────────────

/**
 * Change a user's role, or enable/disable their account.
 *
 * An administrator cannot demote or disable themselves. It is the one change on
 * this screen that cannot be undone by the person making it — the moment it
 * takes effect they no longer have the permission needed to reverse it, and if
 * they are the only administrator the panel is locked for everyone. Removing an
 * administrator is therefore something another administrator has to do.
 */
export async function updateUserAccess(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.USER_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const userId = String(formData.get('userId') ?? '')
  const intent = String(formData.get('intent') ?? '')

  if (!userId) return errorState('No user was named.')

  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
    },
  })

  if (!target) return errorState('That user no longer exists.')

  const name = `${target.firstName} ${target.lastName}`

  if (target.id === staff.id) {
    return errorState(
      'You cannot change your own role or disable your own account. Ask another administrator.',
    )
  }

  // ── Enable / disable ──────────────────────────────────────────────────────

  if (intent === 'toggle-active') {
    const isActive = !target.isActive

    await db.user.update({ where: { id: target.id }, data: { isActive } })

    // A disabled account with a live session is still signed in. Ending the
    // sessions is what actually locks them out.
    if (!isActive) await destroyAllSessionsFor(target.id)

    await record({
      userId: staff.id,
      action: AuditAction.USER_ROLE_CHANGE,
      entityType: 'User',
      entityId: target.id,
      summary: `${isActive ? 'Enabled' : 'Disabled'} the account for ${name} (${target.email}).`,
      metadata: { email: target.email, isActive },
    })

    revalidatePath('/admin/users')

    return successState(
      isActive
        ? `${name} can sign in again.`
        : `${name} has been disabled and signed out everywhere.`,
    )
  }

  // ── Role ──────────────────────────────────────────────────────────────────

  const parsed = roleSchema.safeParse(formData.get('role'))

  if (!parsed.success) return errorState('That is not a role.')

  const role = parsed.data as Role

  if (role === target.role) {
    return errorState(`${name} already has that role.`)
  }

  await db.user.update({ where: { id: target.id }, data: { role } })

  // Permissions are read from the session's user row on every request, so a
  // demotion takes effect immediately — but ending the sessions of someone
  // leaving a staff role is the honest version of revoking their access.
  if (isStaff(target.role as Role) && !isStaff(role)) {
    await destroyAllSessionsFor(target.id)
  }

  await record({
    userId: staff.id,
    action: AuditAction.USER_ROLE_CHANGE,
    entityType: 'User',
    entityId: target.id,
    summary: `Changed ${name} (${target.email}) from ${target.role} to ${role}.`,
    metadata: { email: target.email, from: target.role, to: role },
  })

  revalidatePath('/admin/users')

  return successState(
    `${name} is now ${ROLE_LABELS[role] ?? role}.${
      isStaff(target.role as Role) && !isStaff(role)
        ? ' Their sessions have been ended.'
        : ''
    }`,
  )
}

// ── Site settings ───────────────────────────────────────────────────────────

/**
 * Save the settings form (§15 "content changes need no redeploy").
 *
 * Only keys that already exist are written. A settings table that accepts new
 * keys from a form is a settings table anyone with the panel open can fill with
 * junk, and the reading code has a fixed vocabulary anyway (lib/settings.ts).
 */
export async function updateSettings(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.SETTINGS_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const existing = await db.siteSetting.findMany({
    select: { key: true, value: true, label: true },
  })

  const changed: string[] = []

  for (const row of existing) {
    const submitted = formData.get(row.key)

    if (submitted === null) continue

    const value = String(submitted).trim()

    if (value === row.value) continue

    await db.siteSetting.update({ where: { key: row.key }, data: { value } })
    changed.push(row.label || row.key)
  }

  if (changed.length === 0) {
    return successState('Nothing was changed.')
  }

  await record({
    userId: staff.id,
    action: AuditAction.SETTINGS_UPDATE,
    entityType: 'SiteSetting',
    summary: `Updated ${changed.length} setting${changed.length === 1 ? '' : 's'}: ${changed.join(', ')}.`,
    metadata: { changed },
  })

  // The settings feed the header and footer of every page.
  revalidatePath('/', 'layout')

  return successState(
    `Saved. ${changed.length} setting${changed.length === 1 ? '' : 's'} updated — the change is live now.`,
  )
}
