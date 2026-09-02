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
import { submitFundingApplication } from '@/lib/actions/deal-room'
import { idleState } from '@/lib/actions/types'
import { OPPORTUNITY_STAGE_LABELS, SL_REGIONS } from '@/lib/enums'

/**
 * "Apply for Funding" — the business's door into the Deal Room (§4.12, FR-15).
 *
 * Grouped into four fieldsets rather than one long column. This form is long
 * because the secretariat cannot assess a proposition without the substance,
 * and a long form on a phone needs visible landmarks or it reads as endless.
 * The two long-answer fields are last, so the quick facts are banked before
 * the applicant has to think.
 *
 * On success the form is replaced by the reference number. That number is the
 * only thing the applicant has to keep, so it gets the whole panel rather than
 * a line in a notice.
 */

export type SectorOption = { id: string; name: string }

export function FundingApplicationForm({
  sectors,
}: {
  sectors: SectorOption[]
}) {
  const [state, formAction] = useActionState(
    submitFundingApplication,
    idleState,
  )

  if (state.status === 'success') {
    return (
      <FormMessage status="success">
        <p className="font-medium">Application received</p>
        <p className="mt-1">{state.message}</p>

        {state.data?.reference && (
          <p className="mt-4 font-display text-2xl font-bold tracking-wide">
            {state.data.reference}
          </p>
        )}

        <p className="mt-3 text-sm">
          Keep that reference — quote it in any correspondence with the
          secretariat.
        </p>
      </FormMessage>
    )
  }

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-10">
      <Honeypot />

      <ErrorSummary errors={errors} />

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {/* ── 1. The business ──────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-semibold text-ink-950">
          1. The business
        </legend>

        <Field
          label="Business name"
          name="businessName"
          error={errors?.businessName}
          required
        >
          <Input
            name="businessName"
            autoComplete="organization"
            required
            error={errors?.businessName}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sector" name="sectorId" error={errors?.sectorId}>
            <Select name="sectorId" defaultValue="" error={errors?.sectorId}>
              <option value="">Choose a sector</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Region" name="region" error={errors?.region}>
            <Select name="region" defaultValue="" error={errors?.region}>
              <option value="">Choose a region</option>
              {SL_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Years trading"
            name="yearsTrading"
            error={errors?.yearsTrading}
          >
            <Input
              name="yearsTrading"
              inputMode="numeric"
              placeholder="4"
              error={errors?.yearsTrading}
            />
          </Field>

          <Field label="Employees" name="employees" error={errors?.employees}>
            <Input
              name="employees"
              inputMode="numeric"
              placeholder="24"
              error={errors?.employees}
            />
          </Field>
        </div>
      </fieldset>

      {/* ── 2. Contact ───────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-semibold text-ink-950">
          2. Who we should talk to
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Contact name"
            name="contactName"
            error={errors?.contactName}
            required
          >
            <Input
              name="contactName"
              autoComplete="name"
              required
              error={errors?.contactName}
            />
          </Field>

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
              required
              error={errors?.email}
            />
          </Field>
        </div>

        <Field
          label="Phone"
          name="phone"
          error={errors?.phone}
          hint="A Sierra Leone number the secretariat can reach you on."
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
      </fieldset>

      {/* ── 3. The ask ───────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-semibold text-ink-950">
          3. What you are seeking
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Amount sought"
            name="amountRequestedMinor"
            error={errors?.amountRequestedMinor}
            hint="In figures — 250000, not “a quarter of a million”."
            required
          >
            <div className="flex gap-2">
              <Input
                name="amountRequestedMinor"
                inputMode="decimal"
                placeholder="250000"
                required
                error={errors?.amountRequestedMinor}
              />
              <Select name="currency" defaultValue="USD" className="w-28">
                <option value="USD">USD</option>
                <option value="SLE">SLE</option>
              </Select>
            </div>
          </Field>

          <Field label="Stage" name="stage" error={errors?.stage} required>
            <Select name="stage" defaultValue="GROWTH" error={errors?.stage}>
              {Object.entries(OPPORTUNITY_STAGE_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </Select>
          </Field>
        </div>

        <Field
          label="Annual revenue"
          name="annualRevenueMinor"
          error={errors?.annualRevenueMinor}
          hint="Last full year, in the currency chosen above. Leave blank if pre-revenue."
        >
          <Input
            name="annualRevenueMinor"
            inputMode="decimal"
            error={errors?.annualRevenueMinor}
          />
        </Field>
      </fieldset>

      {/* ── 4. The proposition ───────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="mb-1 font-display text-lg font-semibold text-ink-950">
          4. The proposition
        </legend>

        <Field
          label="What the business does"
          name="businessDescription"
          error={errors?.businessDescription}
          hint="What you sell, to whom, and what makes it work. At least a few sentences."
          required
        >
          <Textarea
            name="businessDescription"
            rows={7}
            required
            error={errors?.businessDescription}
          />
        </Field>

        <Field
          label="What the money is for"
          name="useOfFunds"
          error={errors?.useOfFunds}
          hint="Be specific. “Working capital” tells an investor nothing; “three trucks and eight months of fuel” tells them everything."
          required
        >
          <Textarea
            name="useOfFunds"
            rows={7}
            required
            error={errors?.useOfFunds}
          />
        </Field>
      </fieldset>

      <div className="border-t border-ink-200 pt-8">
        <SubmitButton
          variant="accent"
          size="lg"
          pendingLabel="Submitting…"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Submit application
        </SubmitButton>

        <p className="mt-4 text-sm text-ink-600">
          Submitting does not publish anything. The secretariat assesses every
          application and comes back to you either way — nothing appears in the
          Deal Room without your agreement on what it says.
        </p>
      </div>
    </form>
  )
}
