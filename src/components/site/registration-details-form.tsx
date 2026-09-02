'use client'

import { useActionState } from 'react'

import {
  ErrorSummary,
  Field,
  FormMessage,
  Honeypot,
  Input,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { createRegistration } from '@/lib/actions/registration'
import { idleState } from '@/lib/actions/types'

/**
 * Step 2 — the lead delegate and billing contact (§4.9).
 *
 * The ticket selection travels in hidden fields and is re-priced server-side
 * before anything is written, so these five inputs are the only thing the
 * delegate has to fill in. The other delegates on a group booking are named
 * later, from the portal — asking for nine colleagues' email addresses before
 * anyone has paid is how a group booking gets abandoned.
 *
 * On success the action redirects rather than returning, so there is no
 * success branch here: the page changes.
 */

export type TicketSelection = {
  eventId: string
  ticketTypeId: string
  quantity: number
  currency: string
  promoCode: string
}

export function RegistrationDetailsForm({
  selection,
  isGroup,
}: {
  selection: TicketSelection
  isGroup: boolean
}) {
  const [state, formAction] = useActionState(createRegistration, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-6">
      <Honeypot />

      {/*
        The selection, carried forward. These are re-validated and re-priced in
        the action — a hidden field is a suggestion from the browser, never a
        fact (see lib/actions/registration.ts).
      */}
      <input type="hidden" name="eventId" value={selection.eventId} />
      <input type="hidden" name="ticketTypeId" value={selection.ticketTypeId} />
      <input type="hidden" name="quantity" value={selection.quantity} />
      <input type="hidden" name="currency" value={selection.currency} />
      {selection.promoCode && (
        <input type="hidden" name="promoCode" value={selection.promoCode} />
      )}

      <ErrorSummary errors={errors} />

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="First name"
          name="firstName"
          error={errors?.firstName}
          required
        >
          <Input
            name="firstName"
            autoComplete="given-name"
            required
            error={errors?.firstName}
          />
        </Field>

        <Field
          label="Last name"
          name="lastName"
          error={errors?.lastName}
          required
        >
          <Input
            name="lastName"
            autoComplete="family-name"
            required
            error={errors?.lastName}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Email address"
          name="email"
          error={errors?.email}
          hint="Your e-ticket and receipt go here."
          required
        >
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            error={errors?.email}
          />
        </Field>

        <Field
          label="Phone"
          name="phone"
          error={errors?.phone}
          hint="Used for the payment prompt and the SMS confirmation."
          required
        >
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            error={errors?.phone}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Organisation"
          name="organisation"
          error={errors?.organisation}
        >
          <Input
            name="organisation"
            autoComplete="organization"
            error={errors?.organisation}
          />
        </Field>

        <Field label="Job title" name="jobTitle" error={errors?.jobTitle}>
          <Input
            name="jobTitle"
            autoComplete="organization-title"
            error={errors?.jobTitle}
          />
        </Field>
      </div>

      <Field
        label="Country"
        name="country"
        error={errors?.country}
        required
      >
        <Input
          name="country"
          autoComplete="country-name"
          defaultValue="Sierra Leone"
          required
          error={errors?.country}
        />
      </Field>

      {isGroup && (
        <Field
          label="Group or delegation name"
          name="groupName"
          error={errors?.groupName}
          hint="Shown on the invoice and at the registration desk."
        >
          <Input name="groupName" error={errors?.groupName} />
        </Field>
      )}

      <div className="grid gap-5 border-t border-ink-200 pt-6 sm:grid-cols-2">
        <Field
          label="Dietary requirements"
          name="dietary"
          error={errors?.dietary}
          hint="Catering is arranged from these — tell us anything we need to know."
        >
          <Textarea name="dietary" rows={3} error={errors?.dietary} />
        </Field>

        <Field
          label="Access requirements"
          name="accessibility"
          error={errors?.accessibility}
          hint="Mobility, hearing, sight — whatever would make the days work better."
        >
          <Textarea
            name="accessibility"
            rows={3}
            error={errors?.accessibility}
          />
        </Field>
      </div>

      <div className="border-t border-ink-200 pt-6">
        <SubmitButton
          variant="accent"
          size="lg"
          fullWidth
          pendingLabel="Saving…"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Continue to payment
        </SubmitButton>

        <p className="mt-4 text-sm text-ink-600">
          Nothing is charged yet. You choose how to pay on the next step, and
          your place is held as pending until the payment clears.
        </p>

        <p className="mt-3 text-xs text-ink-500">
          By registering you accept the{' '}
          <a href="/terms" className="underline hover:text-ink-800">
            terms & conditions
          </a>{' '}
          and the{' '}
          <a href="/privacy" className="underline hover:text-ink-800">
            privacy policy
          </a>
          .
        </p>
      </div>
    </form>
  )
}
