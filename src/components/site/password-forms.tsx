'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { ButtonLink } from '@/components/ui/button'
import {
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  SubmitButton,
} from '@/components/ui/form'
import {
  changePassword,
  requestPasswordReset,
  resetPassword,
} from '@/lib/actions/auth'
import { idleState } from '@/lib/actions/types'

/**
 * The three password forms (FR-03).
 *
 * They share a file because they share a rule: none of them ever tells the
 * person filling it in whether an email address has an account. "Forgotten your
 * password" reports the same success for an unknown address as for a real one,
 * and the copy is written so that reply is honest rather than evasive — it says
 * *if* an account exists.
 */

// ── Request a reset link ────────────────────────────────────────────────────

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, idleState)

  if (state.status === 'success') {
    return (
      <div className="space-y-5">
        <FormMessage status="success">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1">{state.message}</p>
        </FormMessage>

        <p className="text-sm text-ink-600">
          Nothing arrived? Check the spam folder, and make sure you used the
          address the forum has on file for you. If you are still stuck, the
          secretariat can help.
        </p>

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/portal/login" variant="outline" size="md">
            Back to sign in
          </ButtonLink>
          <ButtonLink href="/contact" variant="ghost" size="md">
            Contact the secretariat
          </ButtonLink>
        </div>
      </div>
    )
  }

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <Field label="Email address" name="email" error={errors?.email} required>
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

      <div className="flex items-center justify-between gap-4">
        <SubmitButton size="md" pendingLabel="Sending…">
          Send reset link
        </SubmitButton>

        <Link
          href="/portal/login"
          className="text-sm font-medium text-forest-700 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  )
}

// ── Set a new password from an emailed link ─────────────────────────────────

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPassword, idleState)

  if (state.status === 'success') {
    return (
      <div className="space-y-5">
        <FormMessage status="success">
          <p className="font-medium">Password changed</p>
          <p className="mt-1">{state.message}</p>
        </FormMessage>

        <p className="text-sm text-ink-600">
          For safety, this also signed you out everywhere else. Any other device
          that was signed in will need the new password.
        </p>

        <ButtonLink href="/portal/login" size="md">
          Sign in
        </ButtonLink>
      </div>
    )
  }

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />

      <ErrorSummary errors={errors} />

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">
          <p>{state.message}</p>
          <p className="mt-2">
            <Link
              href="/portal/forgot-password"
              className="font-medium underline underline-offset-2"
            >
              Request a new link
            </Link>
          </p>
        </FormMessage>
      )}

      <Field
        label="New password"
        name="password"
        hint="At least 10 characters. A short phrase you will remember beats a short jumble you will not."
        error={errors?.password}
        required
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          error={errors?.password}
        />
      </Field>

      <Field
        label="Confirm new password"
        name="confirmPassword"
        error={errors?.confirmPassword}
        required
      >
        <Input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          error={errors?.confirmPassword}
        />
      </Field>

      <SubmitButton size="md" pendingLabel="Saving…">
        Set new password
      </SubmitButton>
    </form>
  )
}

// ── Change a password from inside the portal ────────────────────────────────

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changePassword, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <Field
        label="Current password"
        name="currentPassword"
        error={errors?.currentPassword}
        required
      >
        <Input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          error={errors?.currentPassword}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="New password"
          name="password"
          hint="At least 10 characters."
          error={errors?.password}
          required
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            error={errors?.password}
          />
        </Field>

        <Field
          label="Confirm new password"
          name="confirmPassword"
          error={errors?.confirmPassword}
          required
        >
          <Input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            error={errors?.confirmPassword}
          />
        </Field>
      </div>

      <p className="text-sm text-ink-600">
        Changing your password signs you out on every other device.
      </p>

      <SubmitButton size="md" variant="outline" pendingLabel="Saving…">
        Change password
      </SubmitButton>
    </form>
  )
}
