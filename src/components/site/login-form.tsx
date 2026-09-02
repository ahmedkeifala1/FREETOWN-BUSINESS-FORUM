'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import {
  Field,
  FormMessage,
  Input,
  SubmitButton,
} from '@/components/ui/form'
import { signIn } from '@/lib/actions/auth'
import { idleState } from '@/lib/actions/types'

/**
 * Sign in (§4.16, FR-03).
 *
 * There is no field-level error summary here, unlike the long public forms.
 * A login has two inputs and one real failure mode, and the server answers it
 * with a single message that deliberately does not say which of the two was
 * wrong — listing "check this field" underneath would undo that.
 *
 * `next` rides along in a hidden field so that someone bounced here from a
 * guarded page lands back on it. The action only honours paths on this site.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signIn, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}

      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <Field
        label="Email address"
        name="email"
        error={errors?.email}
        required
      >
        <Input
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          required
          error={errors?.email}
        />
      </Field>

      <Field label="Password" name="password" error={errors?.password} required>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={errors?.password}
        />
      </Field>

      <div className="flex items-center justify-between gap-4">
        <SubmitButton size="md" pendingLabel="Signing you in…">
          Sign in
        </SubmitButton>

        <Link
          href="/portal/forgot-password"
          className="text-sm font-medium text-forest-700 hover:underline"
        >
          Forgotten your password?
        </Link>
      </div>
    </form>
  )
}
