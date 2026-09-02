'use client'

import { useActionState } from 'react'

import {
  ErrorSummary,
  Field,
  FormMessage,
  Honeypot,
  Input,
  RadioCard,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { submitMembershipApplication } from '@/lib/actions/membership'
import { idleState } from '@/lib/actions/types'
import { BUSINESS_SIZE_LABELS, BusinessSize, SL_REGIONS } from '@/lib/enums'

/**
 * Membership application (§4.10, FR-09).
 *
 * The tier is chosen with radio cards rather than a dropdown: it is the one
 * decision on this page that costs money, and a tier the applicant cannot see
 * the price of is a tier they will query by email instead of choosing. The
 * price shown is the row's — the action re-reads it and never trusts this page.
 *
 * Everything the secretariat needs to vet an organisation is required; the
 * fields that only improve the eventual directory entry are not, and the form
 * says which is which. A member can finish the entry from the portal once the
 * membership is live, so nothing here is the last chance to say it.
 */

export type ApplicationTier = {
  id: string
  slug: string
  name: string
  strapline: string | null
  price: string
}

export function MembershipApplicationForm({
  tiers,
  sectors,
  selectedTierSlug,
  signedInEmail,
}: {
  tiers: ApplicationTier[]
  sectors: { id: string; name: string }[]
  selectedTierSlug?: string
  signedInEmail?: string
}) {
  const [state, formAction] = useActionState(
    submitMembershipApplication,
    idleState,
  )

  if (state.status === 'success') {
    return (
      <FormMessage status="success">
        <p className="font-medium">Application received</p>
        <p className="mt-1">{state.message}</p>
        <p className="mt-2">
          The secretariat reviews applications within five working days. Nothing
          is payable until your membership has been approved — we will send the
          invoice and your sign-in details together.
        </p>
      </FormMessage>
    )
  }

  const errors = state.status === 'error' ? state.errors : undefined

  // Fall back to the first tier so the form is never submitted with nothing
  // chosen, and honour ?tier= when it names a tier that is actually on sale.
  const preselected =
    tiers.find((tier) => tier.slug === selectedTierSlug)?.id ?? tiers[0]?.id

  return (
    <form action={formAction} className="space-y-10">
      <Honeypot name="company_url" />

      <ErrorSummary errors={errors} />

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {/* ── Tier ─────────────────────────────────────────────────────────── */}

      <fieldset className="space-y-4">
        <legend className="font-display text-lg font-semibold text-ink-950">
          1. Choose your tier
        </legend>

        {errors?.tierId && (
          <p id="tierId-error" className="text-sm text-red-700">
            {errors.tierId}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {tiers.map((tier) => (
            <RadioCard
              key={tier.id}
              name="tierId"
              value={tier.id}
              title={tier.name}
              description={tier.strapline ?? undefined}
              price={tier.price}
              defaultChecked={tier.id === preselected}
            />
          ))}
        </div>

        <p className="text-sm text-ink-600">
          Nothing is charged now. If your application is approved we will invoice
          the annual fee and you can pay by Orange Money, Afrimoney, card or bank
          transfer.
        </p>
      </fieldset>

      {/* ── Organisation ─────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-semibold text-ink-950">
          2. Your organisation
        </legend>

        <Field
          label="Organisation name"
          name="organisationName"
          error={errors?.organisationName}
          required
        >
          <Input
            name="organisationName"
            autoComplete="organization"
            required
            error={errors?.organisationName}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sector" name="sectorId" error={errors?.sectorId}>
            <Select name="sectorId" error={errors?.sectorId} defaultValue="">
              <option value="">Select a sector</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Region" name="region" error={errors?.region}>
            <Select name="region" error={errors?.region} defaultValue="">
              <option value="">Select a region</option>
              {SL_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Size" name="size" error={errors?.size}>
            <Select name="size" error={errors?.size} defaultValue="">
              <option value="">Select a size</option>
              {Object.values(BusinessSize).map((size) => (
                <option key={size} value={size}>
                  {BUSINESS_SIZE_LABELS[size]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Website" name="website" error={errors?.website}>
            <Input
              name="website"
              type="url"
              inputMode="url"
              placeholder="https://"
              autoComplete="url"
              error={errors?.website}
            />
          </Field>
        </div>

        <Field
          label="What the organisation does"
          name="shortDescription"
          hint="One or two sentences. This becomes the first line of your directory entry, and you can rewrite it later."
          error={errors?.shortDescription}
          required
        >
          <Textarea
            name="shortDescription"
            rows={4}
            maxLength={500}
            required
            error={errors?.shortDescription}
          />
        </Field>
      </fieldset>

      {/* ── Contact ──────────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-lg font-semibold text-ink-950">
          3. Who we should speak to
        </legend>

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

          <Field
            label="Email address"
            name="email"
            hint={
              signedInEmail
                ? 'Your application is attached to the account you are signed in with.'
                : undefined
            }
            error={errors?.email}
            required
          >
            <Input
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              defaultValue={signedInEmail}
              readOnly={Boolean(signedInEmail)}
              error={errors?.email}
            />
          </Field>

          <Field
            label="Phone number"
            name="phone"
            hint="Sierra Leone mobile, e.g. 076 123456"
            error={errors?.phone}
            required
          >
            <Input
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              required
              error={errors?.phone}
            />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-ink-200 pt-6">
        <SubmitButton size="lg" pendingLabel="Sending your application…">
          Submit application
        </SubmitButton>
        <p className="text-sm text-ink-600">
          We will reply within five working days.
        </p>
      </div>
    </form>
  )
}
