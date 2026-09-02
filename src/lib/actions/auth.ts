'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import {
  consumePasswordResetToken,
  createPasswordResetToken,
  createSession,
  destroyAllSessionsFor,
  destroySession,
  getCurrentUser,
  hashPassword,
  pruneExpiredSessions,
  verifyPassword,
} from '@/lib/auth'
import { db } from '@/lib/db'
import { sendPasswordReset } from '@/lib/notifications'
import { Role } from '@/lib/enums'
import { isStaff } from '@/lib/rbac'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  parseForm,
  profileSchema,
  resetPasswordSchema,
} from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Sign-in, sign-out and password management (FR-03, §14).
 *
 * Two rules shape most of what follows.
 *
 * The first is that nothing here confirms whether an email address has an
 * account. A wrong password and an unknown address give the same message, and
 * "forgot password" reports success either way — otherwise the login form is a
 * membership list anyone can read, and this one names the businesses in the
 * country with money.
 *
 * The second is that changing a password ends every other session. Someone who
 * resets a password because they think an account is compromised has to be able
 * to expect that the attacker is now signed out; leaving the old sessions live
 * makes the reset theatre.
 *
 * Rate limiting is deliberately not attempted here — §14 puts it at the WAF,
 * and a counter in the memory of one instance of a horizontally scaled app is
 * a false sense of security rather than a control.
 */

/**
 * A real bcrypt hash of a string nobody knows, compared against when the email
 * address has no account.
 *
 * Without it a missing user returns in a millisecond and a real one takes the
 * ~250ms bcrypt costs, and that difference alone tells an attacker which
 * addresses are registered — the uniform error message would be undone by the
 * clock. It is a genuine hash rather than a made-up string because
 * `bcrypt.compare` against a malformed one is not reliably a slow `false`.
 */
const DUMMY_HASH =
  '$2b$12$/dgmBNMEOC8ZEWriZvGa5ezWEmwEKpTxRIG3o9I9aeYXSfz47PK8C'

/**
 * Where to send someone after they sign in.
 *
 * Only a path on this site is ever honoured. `next=https://evil.example` in a
 * link is the classic open redirect — a phishing page reached through a real
 * login on a real domain — and the check for a leading `//` matters as much as
 * the one for a scheme, because a browser reads `//evil.example` as a host.
 */
function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//')) return fallback
  return next
}

// ── Sign in / out ───────────────────────────────────────────────────────────

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(loginSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const { email, password, next } = parsed.data

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      isActive: true,
      role: true,
    },
  })

  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

  if (!user || !ok || !user.isActive) {
    return errorState('That email address and password do not match.')
  }

  await createSession(user.id)

  // Cheap housekeeping on an action that already writes — no cron needed for
  // something this small.
  try {
    await pruneExpiredSessions()
  } catch {
    // Tidying only; never fail a login over it.
  }

  // Staff land in the admin panel, everyone else in the portal.
  const home = isStaff(user.role as Role) ? '/admin' : '/portal'

  redirect(safeNext(next, home))
}

export async function signOut(): Promise<void> {
  await destroySession()
  redirect('/')
}

// ── Forgotten passwords ─────────────────────────────────────────────────────

export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(forgotPasswordSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const { email } = parsed.data

  // The same answer regardless of what we find. Everything below is
  // best-effort, and none of it changes the reply.
  const confirmation = successState(
    `If an account exists for ${email}, a reset link is on its way. It is valid for one hour.`,
  )

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, email: true, isActive: true },
  })

  if (!user || !user.isActive) return confirmation

  try {
    const token = await createPasswordResetToken(user.id)

    await sendPasswordReset({
      to: user.email,
      firstName: user.firstName,
      token,
    })
  } catch {
    // A mail gateway failure must not become a way to probe for accounts.
  }

  return confirmation
}

export async function resetPassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(resetPasswordSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const { token, password } = parsed.data

  const userId = await consumePasswordResetToken(token)

  if (!userId) {
    return errorState(
      'That reset link has expired or has already been used. Request a new one and try again.',
    )
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(password) },
  })

  // Every existing session, everywhere — see the note at the top of this file.
  await destroyAllSessionsFor(userId)

  return successState(
    'Your password has been changed. You can now sign in with it.',
  )
}

// ── While signed in ─────────────────────────────────────────────────────────

export async function changePassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const current = await getCurrentUser()

  if (!current) return errorState('You must be signed in to do that.')

  const parsed = parseForm(changePasswordSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const { currentPassword, password } = parsed.data

  const user = await db.user.findUnique({
    where: { id: current.id },
    select: { passwordHash: true },
  })

  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return fieldErrors({ currentPassword: 'That is not your current password.' })
  }

  await db.user.update({
    where: { id: current.id },
    data: { passwordHash: await hashPassword(password) },
  })

  // Sign out everywhere, then sign this browser back in, so the person who
  // just changed their password is not logged out of the tab they did it in.
  await destroyAllSessionsFor(current.id)
  await createSession(current.id)

  return successState('Your password has been changed on every device.')
}

export async function updateProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const current = await getCurrentUser()

  if (!current) return errorState('You must be signed in to do that.')

  const parsed = parseForm(profileSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data

  // The email address is not editable here on purpose: changing it is an
  // identity change that needs a confirmation loop through the new inbox, and
  // a profile form that silently reassigns a login is a support ticket waiting
  // to happen. The portal points people at the secretariat instead.
  await db.user.update({
    where: { id: current.id },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      country: data.country ?? null,
    },
  })

  revalidatePath('/portal')

  return successState('Your details have been saved.')
}
