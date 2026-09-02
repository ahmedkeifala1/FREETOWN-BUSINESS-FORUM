'use client'

import { useActionState, useState } from 'react'

import {
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  RadioCard,
  SubmitButton,
} from '@/components/ui/form'
import { startPayment } from '@/lib/actions/registration'
import { idleState } from '@/lib/actions/types'

/**
 * Step 3 — payment method (§4.9, FR-07).
 *
 * The mobile-money number field appears only for the two methods that need
 * one. That is the single piece of client state on this page, and it earns it:
 * the alternative is asking every card payer for a wallet number, or hiding
 * the field behind a page load in the middle of a checkout.
 *
 * It degrades honestly. Without JavaScript the field renders visible for every
 * method — the server's `paymentSelectionSchema` requires it only for Orange
 * Money and Afrimoney, so a card payer who leaves it blank is not blocked.
 */

export type MethodOption = {
  method: string
  displayName: string
  blurb: string
  requiresPhone: boolean
}

export function PaymentMethodForm({
  reference,
  methods,
  defaultPhone,
}: {
  reference: string
  methods: MethodOption[]
  defaultPhone: string
}) {
  const [state, formAction] = useActionState(startPayment, idleState)
  const [selected, setSelected] = useState(methods[0]?.method ?? '')

  const errors = state.status === 'error' ? state.errors : undefined
  const needsPhone =
    methods.find((option) => option.method === selected)?.requiresPhone ?? false

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="reference" value={reference} />

      <ErrorSummary errors={errors} />

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <fieldset>
        <legend className="mb-4 font-display text-lg font-semibold text-ink-950">
          How would you like to pay?
        </legend>

        <div
          className="space-y-3"
          onChange={(event) => {
            const target = event.target as HTMLInputElement
            if (target.name === 'method') setSelected(target.value)
          }}
        >
          {methods.map((option, index) => (
            <RadioCard
              key={option.method}
              name="method"
              value={option.method}
              title={option.displayName}
              description={option.blurb}
              defaultChecked={index === 0}
            />
          ))}
        </div>
      </fieldset>

      {/*
        `hidden` rather than unmounted: an unmounted input is absent from the
        FormData, and the browser's autofill has already put the delegate's
        number in this one. Keeping it mounted means switching back to Orange
        Money does not clear what they typed.
      */}
      <div hidden={!needsPhone}>
        <Field
          label="Mobile money number"
          name="payerPhone"
          error={errors?.payerPhone}
          hint="The number registered to the wallet you are paying from. The approval prompt goes here."
        >
          <Input
            name="payerPhone"
            type="tel"
            autoComplete="tel"
            defaultValue={defaultPhone}
            error={errors?.payerPhone}
          />
        </Field>
      </div>

      <div className="border-t border-ink-200 pt-6">
        <SubmitButton
          variant="accent"
          size="lg"
          fullWidth
          pendingLabel="Contacting your provider…"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Pay now
        </SubmitButton>

        <p className="mt-4 text-sm text-ink-600">
          Card payments are completed on our provider’s own secure page. FBF
          never sees or stores your card details.
        </p>
      </div>
    </form>
  )
}
