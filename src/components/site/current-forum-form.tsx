'use client'

import { useActionState } from 'react'

import { FormMessage, SubmitButton } from '@/components/ui/form'
import { setCurrentEvent } from '@/lib/actions/admin-events'
import { idleState } from '@/lib/actions/types'

/**
 * Handing the site over to another forum (§4.4).
 *
 * A form of its own on each row rather than a link, because it changes what
 * every visitor sees — the header, the countdown and where the registration
 * button leads — and a GET that did this would fire on any prefetch or link
 * scanner.
 *
 * Its own action state per row for the same reason the track rows have one: a
 * failure belongs beside the forum it failed on, not above the whole list.
 */
export function CurrentForumForm({
  eventId,
  eventName,
}: {
  eventId: string
  eventName: string
}) {
  const [state, formAction] = useActionState(setCurrentEvent, idleState)

  return (
    <div className="space-y-2 text-right">
      <form action={formAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <SubmitButton variant="outline" size="sm" pendingLabel="Switching…">
          Make current
        </SubmitButton>
      </form>

      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {state.status === 'success' && (
        <FormMessage status="success">
          {eventName} is now the current forum.
        </FormMessage>
      )}
    </div>
  )
}
