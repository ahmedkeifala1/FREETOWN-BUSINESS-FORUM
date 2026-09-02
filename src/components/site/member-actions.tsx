'use client'

import { useActionState } from 'react'

import { FormMessage, Select, SubmitButton } from '@/components/ui/form'
import {
  activateMembership,
  setMemberStatus,
} from '@/lib/actions/admin-members'
import { idleState } from '@/lib/actions/types'
import { MemberStatus } from '@/lib/enums'

/**
 * The two things staff do to a membership (FR-09, §12).
 *
 * They are separate forms because they are separate decisions with very
 * different consequences. Activating raises an invoice and emails the member a
 * link to set their password; suspending pulls their directory entry. A single
 * status dropdown containing "Active" alongside "Suspended" would make the
 * first happen with the same gesture as the second, and the audit trail would
 * record them as the same kind of event.
 *
 * The permission is re-checked inside both actions. This component only decides
 * what to draw (§12).
 */

/** Statuses reachable from the dropdown — ACTIVE is deliberately not one. */
const MANUAL_STATUSES = [
  MemberStatus.PENDING,
  MemberStatus.EXPIRED,
  MemberStatus.SUSPENDED,
  MemberStatus.CANCELLED,
] as const

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending — awaiting vetting',
  EXPIRED: 'Expired — lapsed, may renew',
  SUSPENDED: 'Suspended — benefits withdrawn',
  CANCELLED: 'Cancelled — left the forum',
}

export function MemberActions({
  memberId,
  status,
  organisationName,
}: {
  memberId: string
  status: string
  organisationName: string
}) {
  const [activateState, activateAction] = useActionState(
    activateMembership,
    idleState,
  )
  const [statusState, statusAction] = useActionState(
    setMemberStatus,
    idleState,
  )

  const isActive = status === MemberStatus.ACTIVE

  return (
    <div className="space-y-6">
      {/* ── Activate or renew ──────────────────────────────────────────── */}

      <div>
        {activateState.status === 'success' && (
          <div className="mb-4">
            <FormMessage status="success">
              {activateState.message}
            </FormMessage>
          </div>
        )}

        {activateState.status === 'error' && activateState.message && (
          <div className="mb-4">
            <FormMessage status="error">{activateState.message}</FormMessage>
          </div>
        )}

        <form action={activateAction}>
          <input type="hidden" name="memberId" value={memberId} />

          <SubmitButton
            size="md"
            pendingLabel={isActive ? 'Renewing…' : 'Activating…'}
          >
            {isActive ? 'Renew for another period' : 'Activate membership'}
          </SubmitButton>
        </form>

        <p className="mt-2 text-sm text-ink-600">
          {isActive
            ? 'Extends the expiry date and raises a fresh invoice for the next period.'
            : `Sets ${organisationName} active, raises the first invoice, and emails them a link to set their password.`}
        </p>
      </div>

      <hr className="border-ink-200" />

      {/* ── Any other status ───────────────────────────────────────────── */}

      <div>
        {statusState.status === 'success' && (
          <div className="mb-4">
            <FormMessage status="success">{statusState.message}</FormMessage>
          </div>
        )}

        {statusState.status === 'error' && statusState.message && (
          <div className="mb-4">
            <FormMessage status="error">{statusState.message}</FormMessage>
          </div>
        )}

        <form action={statusAction} className="space-y-3">
          <input type="hidden" name="memberId" value={memberId} />

          <label
            htmlFor="status"
            className="block text-sm font-medium text-ink-900"
          >
            Change status to
          </label>

          <Select name="status" defaultValue="">
            <option value="" disabled>
              Choose a status
            </option>
            {MANUAL_STATUSES.filter((value) => value !== status).map(
              (value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ),
            )}
          </Select>

          <SubmitButton variant="outline" size="md" pendingLabel="Saving…">
            Change status
          </SubmitButton>
        </form>

        <p className="mt-2 text-sm text-ink-600">
          Suspending or cancelling also unpublishes their directory entry.
        </p>
      </div>
    </div>
  )
}
