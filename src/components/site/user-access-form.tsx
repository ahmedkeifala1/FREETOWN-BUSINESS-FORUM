'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { FormMessage, Select, SubmitButton } from '@/components/ui/form'
import { updateUserAccess } from '@/lib/actions/admin-settings'
import { idleState } from '@/lib/actions/types'
import { ROLE_LABELS, Role } from '@/lib/enums'

/**
 * Change a user's role, or turn their account off (§12).
 *
 * Both submit to the same action, distinguished by `intent`, because they are
 * two halves of the same question — what may this person do — and the audit
 * trail reads better with them as one kind of event.
 *
 * The controls are absent for the signed-in administrator's own row. The action
 * refuses it too; this only avoids offering a button that always fails.
 */
export function UserAccessForm({
  userId,
  role,
  isActive,
  isSelf,
}: {
  userId: string
  role: string
  isActive: boolean
  isSelf: boolean
}) {
  const [state, formAction] = useActionState(updateUserAccess, idleState)

  if (isSelf) {
    return (
      <p className="text-sm text-ink-500">
        This is you — another administrator has to change your access.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <form action={formAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="intent" value="role" />

          <div className="space-y-1">
            <label
              htmlFor={`role-${userId}`}
              className="block text-xs font-medium text-ink-700"
            >
              Role
            </label>
            <Select
              id={`role-${userId}`}
              name="role"
              defaultValue={role}
              className="min-w-44"
            >
              {Object.values(Role).map((value) => (
                <option key={value} value={value}>
                  {ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
            Change role
          </SubmitButton>
        </form>

        <form action={formAction}>
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="intent" value="toggle-active" />

          <Button
            type="submit"
            variant={isActive ? 'danger' : 'outline'}
            size="sm"
          >
            {isActive ? 'Disable account' : 'Enable account'}
          </Button>
        </form>
      </div>
    </div>
  )
}
