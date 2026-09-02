'use client'

import { useActionState } from 'react'

import {
  Field,
  FormMessage,
  Input,
  SubmitButton,
} from '@/components/ui/form'
import { reconcilePayment } from '@/lib/actions/admin-operations'
import { idleState } from '@/lib/actions/types'

/**
 * Reconciling an invoiced payment (FR-07, FR-14, §12).
 *
 * Two submit buttons on one form, distinguished by the value they send. They
 * are the two answers to the only question finance is asking of a bank
 * statement — did the money arrive or not — and splitting them into separate
 * forms would separate the note from the decision it explains.
 *
 * Recording receipt is not reversible from this screen by design: it issues
 * e-tickets and writes ledger entries, and the ledger is append-only (FR-14).
 * Undoing it is a refund, which is a different action with its own trail.
 */
export function ReconcilePaymentForm({
  paymentId,
  amount,
  reference,
}: {
  paymentId: string
  amount: string
  reference: string
}) {
  const [state, formAction] = useActionState(reconcilePayment, idleState)

  if (state.status === 'success') {
    return <FormMessage status="success">{state.message}</FormMessage>
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="paymentId" value={paymentId} />

      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <p className="text-sm leading-relaxed text-ink-700">
        Recording receipt of <strong>{amount}</strong> against{' '}
        <span className="font-mono">{reference}</span> confirms the
        registration, issues the e-tickets and writes the ledger entries. It
        cannot be undone from here — reversing it is a refund.
      </p>

      <Field
        label="Reference on the statement"
        name="note"
        hint="The bank reference, teller slip number, or whatever will let someone match this to the statement in a year."
      >
        <Input name="note" maxLength={1000} />
      </Field>

      <div className="flex flex-wrap gap-3">
        <SubmitButton
          name="outcome"
          value="settle"
          size="md"
          pendingLabel="Recording…"
        >
          Money received
        </SubmitButton>

        <SubmitButton
          name="outcome"
          value="fail"
          variant="outline"
          size="md"
          pendingLabel="Recording…"
        >
          Not received
        </SubmitButton>
      </div>
    </form>
  )
}
