'use client'

import { useActionState } from 'react'

import {
  ErrorSummary,
  Field,
  FormMessage,
  Honeypot,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { requestInvestorAccess } from '@/lib/actions/deal-room'
import { idleState } from '@/lib/actions/types'

/**
 * "Invest / Request Access" — the investor's door into a proposition (§4.12).
 *
 * Deliberately short. This is a first contact, not due diligence: enough for
 * the business behind the proposition to decide whether to release the pack,
 * and no more. Everything past the email address is optional, and the form
 * says so — an investor who abandons this because it asked for their fund's
 * structure is an investor the member never hears from.
 *
 * The opportunity id travels in a hidden field, and the action re-checks that
 * it names a published proposition. A hidden input is a suggestion from the
 * browser, never a fact (see lib/actions/deal-room.ts).
 */
export function InvestorAccessForm({
  opportunityId,
  opportunityTitle,
}: {
  opportunityId: string
  opportunityTitle: string
}) {
  const [state, formAction] = useActionState(requestInvestorAccess, idleState)

  if (state.status === 'success') {
    return (
      <FormMessage status="success">
        <p className="font-medium">Request sent</p>
        <p className="mt-1">{state.message}</p>
      </FormMessage>
    )
  }

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      <Honeypot />

      <input type="hidden" name="opportunityId" value={opportunityId} />

      <ErrorSummary errors={errors} />

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <p className="text-sm text-ink-600">
        Requesting access to <strong>{opportunityTitle}</strong>. The
        secretariat passes your request to the business, and the full pack is
        released only with their agreement.
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Your name"
          name="investorName"
          error={errors?.investorName}
          required
        >
          <Input
            name="investorName"
            autoComplete="name"
            required
            error={errors?.investorName}
          />
        </Field>

        <Field label="Email address" name="email" error={errors?.email} required>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            error={errors?.email}
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

        <Field label="Phone" name="phone" error={errors?.phone}>
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            error={errors?.phone}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country" name="country" error={errors?.country}>
          <Input
            name="country"
            autoComplete="country-name"
            error={errors?.country}
          />
        </Field>

        <Field
          label="Typical ticket size"
          name="ticketSizeMinor"
          error={errors?.ticketSizeMinor}
          hint="Roughly what you deploy per investment."
        >
          <div className="flex gap-2">
            <Input
              name="ticketSizeMinor"
              inputMode="decimal"
              placeholder="250000"
              error={errors?.ticketSizeMinor}
            />
            <Select name="currency" defaultValue="USD" className="w-28">
              <option value="USD">USD</option>
              <option value="SLE">SLE</option>
            </Select>
          </div>
        </Field>
      </div>

      <Field
        label="Investment focus"
        name="investmentFocus"
        error={errors?.investmentFocus}
        hint="Sectors, stages or geographies you look at."
      >
        <Input name="investmentFocus" error={errors?.investmentFocus} />
      </Field>

      <Field
        label="Anything to add"
        name="message"
        error={errors?.message}
        hint="What you would want to see first, or a question for the business."
      >
        <Textarea name="message" rows={4} error={errors?.message} />
      </Field>

      <SubmitButton
        variant="accent"
        size="lg"
        fullWidth
        pendingLabel="Sending…"
        className="rounded-none font-semibold uppercase tracking-wider"
      >
        Request access
      </SubmitButton>

      <p className="text-xs text-ink-500">
        Your details are shared with the business behind this proposition and
        with the FBF secretariat, and with nobody else. See the{' '}
        <a href="/privacy" className="underline hover:text-ink-800">
          privacy policy
        </a>
        .
      </p>
    </form>
  )
}
