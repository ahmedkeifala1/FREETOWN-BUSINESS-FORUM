'use client'

import { useActionState } from 'react'

import {
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { updateMyListing } from '@/lib/actions/directory'
import { idleState } from '@/lib/actions/types'
import { BUSINESS_SIZE_LABELS, BusinessSize, SL_REGIONS } from '@/lib/enums'

/**
 * A member writing their own directory entry (§4.11, §4.16).
 *
 * Nothing on this form identifies which listing is being edited. The action
 * resolves that from the session, because a hidden listing id here would be
 * an invitation to edit somebody else's business.
 *
 * The split between the short and the full description is the split between
 * the card in the search results and the page behind it. The form says so,
 * because a member who does not know that writes the same paragraph twice.
 */

export type ListingDefaults = {
  businessName: string
  shortDescription: string
  fullDescription: string | null
  sectorId: string | null
  region: string | null
  size: string | null
  logoUrl: string | null
  website: string | null
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  yearFounded: number | null
  employees: number | null
}

export function DirectoryListingForm({
  defaults,
  sectors,
}: {
  defaults: ListingDefaults | null
  sectors: { id: string; name: string }[]
}) {
  const [state, formAction] = useActionState(updateMyListing, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-8">
      <ErrorSummary errors={errors} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {/* ── The business ─────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          The business
        </legend>

        <Field
          label="Business name"
          name="businessName"
          hint="As you want it to appear in the directory."
          error={errors?.businessName}
          required
        >
          <Input
            name="businessName"
            autoComplete="organization"
            defaultValue={defaults?.businessName ?? ''}
            required
            error={errors?.businessName}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sector" name="sectorId" error={errors?.sectorId}>
            <Select
              name="sectorId"
              error={errors?.sectorId}
              defaultValue={defaults?.sectorId ?? ''}
            >
              <option value="">Select a sector</option>
              {sectors.map((sector) => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Region" name="region" error={errors?.region}>
            <Select
              name="region"
              error={errors?.region}
              defaultValue={defaults?.region ?? ''}
            >
              <option value="">Select a region</option>
              {SL_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Size" name="size" error={errors?.size}>
            <Select
              name="size"
              error={errors?.size}
              defaultValue={defaults?.size ?? ''}
            >
              <option value="">Select a size</option>
              {Object.values(BusinessSize).map((size) => (
                <option key={size} value={size}>
                  {BUSINESS_SIZE_LABELS[size]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Year founded"
            name="yearFounded"
            error={errors?.yearFounded}
          >
            <Input
              name="yearFounded"
              type="number"
              inputMode="numeric"
              min={1800}
              max={new Date().getFullYear()}
              defaultValue={defaults?.yearFounded ?? ''}
              error={errors?.yearFounded}
            />
          </Field>
        </div>

        <Field
          label="Employees"
          name="employees"
          hint="Roughly, including part-time staff."
          error={errors?.employees}
        >
          <Input
            name="employees"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={defaults?.employees ?? ''}
            error={errors?.employees}
          />
        </Field>
      </fieldset>

      {/* ── What you do ──────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          What you do
        </legend>

        <Field
          label="Short description"
          name="shortDescription"
          hint="One or two sentences. This is the line people read in the search results, so lead with what you sell, not with when you were founded."
          error={errors?.shortDescription}
          required
        >
          <Textarea
            name="shortDescription"
            rows={3}
            maxLength={500}
            defaultValue={defaults?.shortDescription ?? ''}
            required
            error={errors?.shortDescription}
          />
        </Field>

        <Field
          label="Full description"
          name="fullDescription"
          hint="The page behind the card. Products and services, the markets you serve, what you are looking for from other members."
          error={errors?.fullDescription}
        >
          <Textarea
            name="fullDescription"
            rows={8}
            defaultValue={defaults?.fullDescription ?? ''}
            error={errors?.fullDescription}
          />
        </Field>
      </fieldset>

      {/* ── How to reach you ─────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          How to reach you
        </legend>

        <p className="text-sm text-ink-600">
          Contact details below the fold are shown to signed-in members only —
          they are not published to the open web (§4.11).
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website" name="website" error={errors?.website}>
            <Input
              name="website"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={defaults?.website ?? ''}
              error={errors?.website}
            />
          </Field>

          <Field label="Logo URL" name="logoUrl" error={errors?.logoUrl}>
            <Input
              name="logoUrl"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={defaults?.logoUrl ?? ''}
              error={errors?.logoUrl}
            />
          </Field>

          <Field
            label="Contact email"
            name="contactEmail"
            error={errors?.contactEmail}
          >
            <Input
              name="contactEmail"
              type="email"
              inputMode="email"
              defaultValue={defaults?.contactEmail ?? ''}
              error={errors?.contactEmail}
            />
          </Field>

          <Field
            label="Contact phone"
            name="contactPhone"
            error={errors?.contactPhone}
          >
            <Input
              name="contactPhone"
              type="tel"
              inputMode="tel"
              defaultValue={defaults?.contactPhone ?? ''}
              error={errors?.contactPhone}
            />
          </Field>
        </div>

        <Field label="Address" name="address" error={errors?.address}>
          <Textarea
            name="address"
            rows={3}
            defaultValue={defaults?.address ?? ''}
            error={errors?.address}
          />
        </Field>
      </fieldset>

      <div className="border-t border-ink-200 pt-6">
        <SubmitButton size="md" pendingLabel="Saving…">
          Save listing
        </SubmitButton>
      </div>
    </form>
  )
}
