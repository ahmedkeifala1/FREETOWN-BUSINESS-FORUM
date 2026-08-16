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
import { submitEnquiry } from '@/lib/actions/contact'
import { idleState } from '@/lib/actions/types'

/**
 * The enquiry form (§4.14).
 *
 * On success the form is replaced by the confirmation rather than cleared and
 * annotated — a blank form with a note above it reads as "did that send?" on a
 * phone, which is where most of these arrive from.
 *
 * The subject line is a select rather than free text so the secretariat can
 * route what arrives; the values match the FormType enum the action stores.
 */
export function ContactForm({ defaultTopic }: { defaultTopic?: string }) {
  const [state, formAction] = useActionState(submitEnquiry, idleState)

  if (state.status === 'success') {
    return (
      <FormMessage status="success">
        <p className="font-medium">Message sent</p>
        <p className="mt-1">{state.message}</p>
      </FormMessage>
    )
  }

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-5">
      <Honeypot />

      <ErrorSummary errors={errors} />

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" error={errors?.name} required>
          <Input
            name="name"
            autoComplete="name"
            required
            error={errors?.name}
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
        <Field label="Phone" name="phone" error={errors?.phone}>
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            error={errors?.phone}
          />
        </Field>

        <Field label="What is this about?" name="formType">
          <Select name="formType" defaultValue={defaultTopic ?? 'CONTACT'}>
            <option value="CONTACT">General enquiry</option>
            <option value="MEMBERSHIP_ENQUIRY">Membership</option>
            <option value="SPONSOR_ENQUIRY">Sponsorship</option>
            <option value="EXHIBITOR_ENQUIRY">Exhibiting</option>
          </Select>
        </Field>
      </div>

      <Field label="Subject" name="subject" error={errors?.subject}>
        <Input name="subject" maxLength={200} error={errors?.subject} />
      </Field>

      <Field
        label="Your message"
        name="message"
        error={errors?.message}
        hint="The more detail you give, the better the reply."
        required
      >
        <Textarea name="message" rows={6} required error={errors?.message} />
      </Field>

      <SubmitButton
        variant="accent"
        size="lg"
        pendingLabel="Sending…"
        className="rounded-none font-semibold uppercase tracking-wider"
      >
        Send enquiry
      </SubmitButton>
    </form>
  )
}
