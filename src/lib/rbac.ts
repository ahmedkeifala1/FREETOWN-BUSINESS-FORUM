import 'server-only'

import { redirect } from 'next/navigation'

import { getCurrentUser, type SessionUser } from '@/lib/auth'
import { Role } from '@/lib/enums'

/**
 * Role-based access control (FR-04, §12).
 *
 * Permissions are checked here, on the server, on every protected action —
 * never in the browser and never by hiding a link. Navigation is filtered for
 * tidiness, but the guard that matters is the one the Server Component or
 * Server Action calls before it touches data.
 */

export const Permission = {
  // Content
  CONTENT_VIEW: 'content.view',
  CONTENT_EDIT: 'content.edit',
  CONTENT_PUBLISH: 'content.publish',
  CONTENT_DELETE: 'content.delete',
  // Event programme
  EVENT_VIEW: 'event.view',
  EVENT_MANAGE: 'event.manage',
  // Registrations and delegates
  REGISTRATION_VIEW: 'registration.view',
  REGISTRATION_MANAGE: 'registration.manage',
  CHECKIN_PERFORM: 'checkin.perform',
  // Money
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_MANAGE: 'payment.manage',
  LEDGER_VIEW: 'ledger.view',
  // Membership and directory
  MEMBERSHIP_VIEW: 'membership.view',
  MEMBERSHIP_MANAGE: 'membership.manage',
  // Deal room
  DEALROOM_VIEW: 'dealroom.view',
  DEALROOM_MANAGE: 'dealroom.manage',
  // Enquiries
  SUBMISSION_VIEW: 'submission.view',
  SUBMISSION_MANAGE: 'submission.manage',
  // Administration
  USER_MANAGE: 'user.manage',
  SETTINGS_MANAGE: 'settings.manage',
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

/**
 * Least-privilege grants per role. ADMIN is handled separately rather than
 * being given an exhaustive list, so a newly added permission is never
 * silently withheld from administrators.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  VISITOR: [],

  MEMBER: [Permission.MEMBERSHIP_VIEW, Permission.DEALROOM_VIEW],

  DELEGATE: [Permission.EVENT_VIEW],

  EDITOR: [
    Permission.CONTENT_VIEW,
    Permission.CONTENT_EDIT,
    Permission.CONTENT_PUBLISH,
    Permission.EVENT_VIEW,
    Permission.SUBMISSION_VIEW,
  ],

  EVENT_MANAGER: [
    Permission.CONTENT_VIEW,
    Permission.CONTENT_EDIT,
    Permission.CONTENT_PUBLISH,
    Permission.EVENT_VIEW,
    Permission.EVENT_MANAGE,
    Permission.REGISTRATION_VIEW,
    Permission.REGISTRATION_MANAGE,
    Permission.CHECKIN_PERFORM,
    Permission.SUBMISSION_VIEW,
    Permission.SUBMISSION_MANAGE,
    Permission.REPORT_VIEW,
    Permission.DEALROOM_VIEW,
  ],

  FINANCE: [
    Permission.REGISTRATION_VIEW,
    Permission.PAYMENT_VIEW,
    Permission.PAYMENT_MANAGE,
    Permission.LEDGER_VIEW,
    Permission.MEMBERSHIP_VIEW,
    Permission.MEMBERSHIP_MANAGE,
    Permission.REPORT_VIEW,
    Permission.AUDIT_VIEW,
  ],

  ADMIN: [],
}

/** Roles that may open the admin panel at all. */
export const STAFF_ROLES: Role[] = [
  Role.EDITOR,
  Role.EVENT_MANAGER,
  Role.FINANCE,
  Role.ADMIN,
]

export function isStaff(role: Role | undefined | null): boolean {
  return !!role && STAFF_ROLES.includes(role)
}

export function roleHas(role: Role, permission: Permission): boolean {
  if (role === Role.ADMIN) return true
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function userHas(
  user: SessionUser | null,
  permission: Permission,
): boolean {
  if (!user) return false
  return roleHas(user.role, permission)
}

// ── Guards ──────────────────────────────────────────────────────────────────

/**
 * Require a signed-in user, sending anonymous visitors to the login page with
 * a return path so they land back where they were headed.
 */
export async function requireUser(options?: {
  redirectTo?: string
}): Promise<SessionUser> {
  const user = await getCurrentUser()

  if (!user) {
    const next = options?.redirectTo
      ? `?next=${encodeURIComponent(options.redirectTo)}`
      : ''
    redirect(`/portal/login${next}`)
  }

  return user
}

/**
 * Require a specific permission.
 *
 * A signed-in but under-privileged user is sent to /access-denied rather than
 * to the login page — bouncing someone who is already authenticated back to a
 * login form is the classic redirect loop, and it tells them nothing.
 */
export async function requirePermission(
  permission: Permission,
  options?: { redirectTo?: string },
): Promise<SessionUser> {
  const user = await requireUser(options)

  if (!userHas(user, permission)) redirect('/access-denied')

  return user
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser()

  if (!roles.includes(user.role)) redirect('/access-denied')

  return user
}

/** Gate for the whole /admin segment. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser({ redirectTo: '/admin' })

  if (!isStaff(user.role)) redirect('/access-denied')

  return user
}

/**
 * Assert inside a Server Action. Throws a plain Error rather than triggering
 * a navigation interrupt, so the action can return a form error state.
 */
export async function assertPermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await getCurrentUser()

  if (!user) throw new Error('You must be signed in to do that.')
  if (!userHas(user, permission)) {
    throw new Error('You do not have permission to do that.')
  }

  return user
}
