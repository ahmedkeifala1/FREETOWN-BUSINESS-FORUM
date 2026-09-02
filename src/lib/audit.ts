import 'server-only'

import { headers } from 'next/headers'

import { db } from '@/lib/db'

/**
 * The audit trail (§14 "audit logging of financial actions", FR-14).
 *
 * Every staff action that moves money, changes what someone is entitled to, or
 * publishes something to the public writes a row here. The trail is the answer
 * to "who activated this membership without an invoice?" three months later,
 * which is a question the forum's auditors will eventually ask.
 *
 * Writing is best-effort by design. An audit row that fails must not roll back
 * the payment it was describing — losing the note is bad, losing the money is
 * worse — so `record` never throws. It is deliberately *not* the control that
 * prevents a bad action; that is RBAC's job (§12). This is the record of what
 * was permitted and done.
 *
 * Nothing here is ever updated or deleted. A trail that can be edited by the
 * people it describes is not a trail.
 */

export const AuditAction = {
  MEMBER_ACTIVATE: 'member.activate',
  MEMBER_SUSPEND: 'member.suspend',
  MEMBER_STATUS: 'member.status',
  LISTING_PUBLISH: 'listing.publish',
  REGISTRATION_STATUS: 'registration.status',
  REGISTRATION_CHECKIN: 'registration.checkin',
  PAYMENT_RECORD_OFFLINE: 'payment.record-offline',
  PAYMENT_REFUND: 'payment.refund',
  APPLICATION_DECISION: 'application.decision',
  ACCESS_REQUEST_DECISION: 'access-request.decision',
  CONTENT_PUBLISH: 'content.publish',
  // The programme is published material and the schedule delegates plan travel
  // around, so a change to it is recorded the same way an article is. Removal
  // is its own action rather than an update with a "deleted" note: it is the
  // one programme change nothing else can evidence afterwards.
  PROGRAMME_UPDATE: 'programme.update',
  PROGRAMME_DELETE: 'programme.delete',
  // The forum record itself — its dates, its venue and which forum the site is
  // currently promoting. Separate from programme.update because it is the one
  // change that moves every page at once: the header, the countdown and the
  // registration target all read the current event.
  EVENT_UPDATE: 'event.update',
  // Media is published material like an article, but a removal here takes a
  // file off the gallery wall or the downloads page with nothing left behind
  // to show what used to be there, so it is recorded separately.
  MEDIA_UPDATE: 'media.update',
  MEDIA_DELETE: 'media.delete',
  USER_ROLE_CHANGE: 'user.role-change',
  SETTINGS_UPDATE: 'settings.update',
} as const

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]

export async function record(input: {
  userId: string | null
  action: AuditAction
  entityType: string
  entityId?: string | null
  summary: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const headerList = await headers()

    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary,
        metadataJson: JSON.stringify(input.metadata ?? {}),
        ipAddress:
          headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      },
    })
  } catch {
    // See the note at the top of this file: never fail the action being
    // audited because the note about it could not be written.
  }
}
