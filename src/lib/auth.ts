import 'server-only'

import { cookies, headers } from 'next/headers'
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { cache } from 'react'

import { db } from '@/lib/db'
import { Role } from '@/lib/enums'

/**
 * Authentication and session management (FR-03, §11 "Auth/session", §14).
 *
 * Design notes:
 *  - Sessions are server-side rows; the cookie carries a random opaque token
 *    and nothing else, so a session can be revoked centrally and the cookie
 *    reveals no user data if intercepted.
 *  - Only the SHA-256 of the token is stored. A leaked database backup does
 *    not hand an attacker usable session cookies.
 *  - Passwords use bcrypt at cost 12 (NFR-05 "hashed passwords").
 */

const SESSION_COOKIE = 'fbf_session'
const SESSION_TTL_DAYS = 14
const BCRYPT_COST = 12

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  role: Role
  phone: string | null
  memberId: string | null
  memberStatus: string | null
}

// ── Password hashing ────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ── Token helpers ───────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Constant-time compare for tokens that arrive from user input. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

// ── Session lifecycle ───────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<void> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)

  const headerList = await headers()

  await db.authSession.create({
    data: {
      token: hashToken(token),
      userId,
      expiresAt,
      ipAddress:
        headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent')?.slice(0, 255) ?? null,
    },
  })

  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    // deleteMany rather than delete: a stale cookie must not throw on logout.
    await db.authSession.deleteMany({ where: { token: hashToken(token) } })
  }

  cookieStore.delete(SESSION_COOKIE)
}

/** Revoke every session for a user — used after a password change. */
export async function destroyAllSessionsFor(userId: string): Promise<void> {
  await db.authSession.deleteMany({ where: { userId } })
}

/**
 * Resolve the signed-in user, or null.
 *
 * Wrapped in React's `cache` so the many components that ask "who is this?"
 * during a single render share one database round-trip.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.authSession.findUnique({
    where: { token: hashToken(token) },
    include: {
      user: {
        include: { member: { select: { id: true, status: true } } },
      },
    },
  })

  if (!session || session.expiresAt < new Date()) return null
  if (!session.user.isActive) return null

  const { user } = session

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role as Role,
    phone: user.phone,
    memberId: user.member?.id ?? null,
    memberStatus: user.member?.status ?? null,
  }
})

/** Remove expired rows. Called opportunistically on login. */
export async function pruneExpiredSessions(): Promise<void> {
  await db.authSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
}

// ── Password reset tokens ───────────────────────────────────────────────────

export async function createPasswordResetToken(
  userId: string,
): Promise<string> {
  const token = generateToken()

  await db.passwordReset.create({
    data: {
      userId,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // one hour
    },
  })

  return token
}

export async function consumePasswordResetToken(
  token: string,
): Promise<string | null> {
  const record = await db.passwordReset.findUnique({
    where: { token: hashToken(token) },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) return null

  await db.passwordReset.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  })

  return record.userId
}
