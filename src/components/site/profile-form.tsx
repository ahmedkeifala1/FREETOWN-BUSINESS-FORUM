'use client'

import { useActionState } from 'react'

import {
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  SubmitButton,
} from '@/components/ui/form'
import { updateProfile } from '@/lib/actions/auth'
import { idleState } from '@/lib/actions/types'

/**
 * Your own details (§4.16 "member dashboard: profile").
 *
 * The email address is shown but not editable. Changing a login is an identity
 * change that has to be confirmed through the new inbox before it takes
 * effect, and a profile form that quietly reassigns the address someone signs
 * in with is how accounts get locked out of themselves.
 */
export function ProfileForm({
  defaults,
  email,
}: {
  defaults: {
    firstName: string
    lastName: string
    phone: string | null
    country: string | null
  }
  email: string
}) {
  const [state, formAction] = useActionState(updateProfile, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      <ErrorSummary errors={errors} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

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
            defaultValue={defaults.firstName}
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
            defaultValue={defaults.lastName}
            required
            error={errors?.lastName}
          />
        </Field>

        <Field
          label="Phone number"
          name="phone"
          hint="Sierra Leone mobile, e.g. 076 123456"
          error={errors?.phone}
        >
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            defaultValue={defaults.phone ?? ''}
            error={errors?.phone}
          />
        </Field>

        <Field label="Country" name="country" error={errors?.country}>
          <Input
            name="country"
            autoComplete="country-name"
            defaultValue={defaults.country ?? ''}
            error={errors?.country}
          />
        </Field>
      </div>

      <div className="rounded-lg bg-ink-50 px-4 py-3">
        <p className="text-sm text-ink-700">
          You sign in with <strong>{email}</strong>. To change it, email the
          secretariat — we confirm the new address before moving your account.
        </p>
      </div>

      <SubmitButton size="md" pendingLabel="Saving…">
        Save details
      </SubmitButton>
    </form>
  )
}
