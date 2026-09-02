'use client'

import { useActionState } from 'react'

import { FormMessage, Select, SubmitButton, Textarea } from '@/components/ui/form'
import { idleState, type FormState } from '@/lib/actions/types'

/**
 * "Move this to a new status", for the review queues (§4.12, §12).
 *
 * One component for funding applications, access requests and enquiries: they
 * differ in vocabulary and in which action they call, not in shape. The Server
 * Action is passed in as a prop, which works because a server action reference
 * is serialisable across the boundary — the client only ever holds a handle to
 * it, never the code.
 *
 * The permission is re-checked inside every one of those actions. This
 * component decides what to draw and nothing else (§12).
 */
export function DecisionForm({
  action,
  idField,
  idValue,
  options,
  label = 'Move to',
  withNotes = false,
  notesLabel = 'Notes',
  notesHint,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>
  idField: string
  idValue: string
  options: { value: string; label: string }[]
  label?: string
  withNotes?: boolean
  notesLabel?: string
  notesHint?: string
}) {
  const [state, formAction] = useActionState(action, idleState)

  return (
    <div className="space-y-4">
      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name={idField} value={idValue} />

        <label
          htmlFor={`status-${idValue}`}
          className="block text-sm font-medium text-ink-900"
        >
          {label}
        </label>

        <Select id={`status-${idValue}`} name="status" defaultValue="">
          <option value="" disabled>
            Choose an outcome
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        {withNotes && (
          <div className="space-y-1.5">
            <label
              htmlFor={`reviewNotes-${idValue}`}
              className="block text-sm font-medium text-ink-900"
            >
              {notesLabel}
            </label>
            {notesHint && <p className="text-xs text-ink-600">{notesHint}</p>}
            <Textarea
              name="reviewNotes"
              id={`reviewNotes-${idValue}`}
              rows={3}
            />
          </div>
        )}

        <SubmitButton variant="outline" size="md" pendingLabel="Saving…">
          Save decision
        </SubmitButton>
      </form>
    </div>
  )
}
