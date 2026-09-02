'use client'

import { useActionState } from 'react'

import { FormMessage, SubmitButton } from '@/components/ui/form'
import { setMyListingVisibility } from '@/lib/actions/directory'
import { idleState } from '@/lib/actions/types'

/**
 * Publish or hide a directory listing (§4.11, §4.16).
 *
 * A form rather than a toggle switch: it is a deliberate act with a public
 * consequence, and a switch that fires on a stray tap would put a half-written
 * entry into the directory. The button says what will happen, not what the
 * current state is.
 */
export function ListingVisibility({
  isPublished,
  canPublish,
}: {
  isPublished: boolean
  canPublish: boolean
}) {
  const [state, formAction] = useActionState(setMyListingVisibility, idleState)

  return (
    <div className="space-y-4">
      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <form action={formAction}>
        <input
          type="hidden"
          name="publish"
          value={isPublished ? 'false' : 'true'}
        />

        {isPublished ? (
          <SubmitButton
            variant="outline"
            size="md"
            pendingLabel="Hiding your listing…"
          >
            Hide from the directory
          </SubmitButton>
        ) : (
          <SubmitButton
            size="md"
            disabled={!canPublish}
            pendingLabel="Publishing your listing…"
          >
            Publish to the directory
          </SubmitButton>
        )}
      </form>

      {!isPublished && !canPublish && (
        <p className="text-sm text-ink-600">
          Publishing unlocks when your membership is active. You can keep
          editing in the meantime — the entry goes live the moment it does.
        </p>
      )}
    </div>
  )
}
