'use client'

import { useActionState, useEffect, useRef } from 'react'

import { FormMessage, Input, SubmitButton } from '@/components/ui/form'
import { checkInDelegate } from '@/lib/actions/admin-operations'
import { idleState } from '@/lib/actions/types'

/**
 * The registration desk (FR-05, §12).
 *
 * One field, always focused, cleared after every submission. A USB barcode
 * scanner is a keyboard that types the payload and presses Enter, so a form
 * whose input holds focus works with a scanner and with a steward typing a
 * code by hand, and needs no scanner-specific code at all.
 *
 * The result is deliberately large. A steward reads it at arm's length across
 * a desk with a queue behind it, and the thing they need is the delegate's
 * name — big enough to check against the person in front of them — not a
 * sentence about what the system did.
 */
export function CheckInForm() {
  const [state, formAction] = useActionState(checkInDelegate, idleState)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear and refocus after every scan, so the next delegate can step up
  // without anyone touching the keyboard.
  useEffect(() => {
    if (state.status === 'idle') return
    formRef.current?.reset()
    inputRef.current?.focus()
  }, [state])

  const admitted = state.status === 'success'
  const repeat = admitted && state.data?.repeat === 'true'

  return (
    <div className="space-y-6">
      <form ref={formRef} action={formAction} className="space-y-4">
        <label
          htmlFor="payload"
          className="block text-sm font-medium text-ink-900"
        >
          Scan the QR code, or type the ticket code
        </label>

        <Input
          ref={inputRef}
          name="payload"
          autoComplete="off"
          autoFocus
          required
          placeholder="FBF-XXXX-XXXX"
          className="font-mono text-lg"
        />

        <SubmitButton size="lg" pendingLabel="Checking…">
          Admit delegate
        </SubmitButton>
      </form>

      {/* ── The answer ───────────────────────────────────────────────────── */}

      {admitted && (
        <div
          role="status"
          className={`rounded-2xl border-2 p-6 text-center ${
            repeat
              ? 'border-amber-400 bg-amber-50'
              : 'border-forest-500 bg-forest-50'
          }`}
        >
          <p className="font-display text-3xl font-bold text-ink-950">
            {state.data?.name}
          </p>

          {state.data?.organisation && (
            <p className="mt-1 text-lg text-ink-700">
              {state.data.organisation}
            </p>
          )}

          {state.data?.jobTitle && (
            <p className="text-sm text-ink-600">{state.data.jobTitle}</p>
          )}

          <p className="mt-3 text-sm font-medium uppercase tracking-wider text-ink-600">
            {state.data?.ticketType}
          </p>

          <p
            className={`mt-4 font-display text-lg font-semibold ${
              repeat ? 'text-amber-800' : 'text-forest-800'
            }`}
          >
            {repeat ? 'Already admitted' : 'Admitted'}
          </p>

          {repeat && (
            <p className="mt-1 text-sm text-ink-700">{state.message}</p>
          )}
        </div>
      )}

      {state.status === 'error' && (
        <FormMessage status="error">
          <p className="text-base font-medium">{state.message}</p>
        </FormMessage>
      )}
    </div>
  )
}
