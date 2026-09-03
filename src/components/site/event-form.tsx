'use client'

import { useActionState } from 'react'

import {
  Checkbox,
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { UploadField } from '@/components/ui/upload'
import { saveEvent } from '@/lib/actions/admin-events'
import { idleState } from '@/lib/actions/types'

/**
 * The forum's own record (§4.4).
 *
 * Long, because a forum is genuinely a lot of facts, and grouped into the four
 * questions a delegate asks in order: what it is, when and where, what it says
 * about itself, and whether it is on sale. The order is the reading order of
 * the events page rather than the column order of the table.
 *
 * There is no delete. A forum is the parent of registrations that were paid
 * for, so the way to take one off the site is to untick "Show on the public
 * site" — which is reversible, unlike the alternative.
 */

export type EventDefaults = {
  id: string
  name: string
  slug: string
  theme: string
  tagline: string | null
  /** Both already in `datetime-local` form — see `toDateTimeInput`. */
  startDate: string
  endDate: string
  venueName: string
  venueAddress: string
  city: string
  country: string
  venueMapUrl: string | null
  venueLat: number | null
  venueLng: number | null
  description: string | null
  /** One objective per line; the action stores them as a JSON array. */
  objectives: string
  expectedDelegates: number | null
  heroImageUrl: string | null
  brochureUrl: string | null
  prospectusUrl: string | null
  isCurrent: boolean
  isPublished: boolean
  registrationOpen: boolean
}

export function EventForm({
  defaults,
  uploadsEnabled,
}: {
  defaults: EventDefaults | null
  /** Whether a blob store is attached — see lib/uploads. Decided on the server. */
  uploadsEnabled: boolean
}) {
  const [state, formAction] = useActionState(saveEvent, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-8">
      {defaults && <input type="hidden" name="eventId" value={defaults.id} />}

      <ErrorSummary errors={errors} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {/* ── What it is ──────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          What it is
        </legend>

        <Field label="Name" name="name" error={errors?.name} required>
          <Input
            name="name"
            defaultValue={defaults?.name ?? ''}
            placeholder="Freetown Business Forum 2027"
            required
            error={errors?.name}
          />
        </Field>

        <Field
          label="Reference"
          name="slug"
          hint="An internal handle for this edition, such as fbf-2027. No public page is addressed by it, so it can be changed later."
          error={errors?.slug}
          required
        >
          <Input
            name="slug"
            defaultValue={defaults?.slug ?? ''}
            placeholder="fbf-2027"
            required
            error={errors?.slug}
          />
        </Field>

        <Field
          label="Theme"
          name="theme"
          hint="The line under the name on the homepage and across the printed programme."
          error={errors?.theme}
          required
        >
          <Input
            name="theme"
            defaultValue={defaults?.theme ?? ''}
            placeholder="Building the Next Economy: Capital, Capability and Connection"
            required
            error={errors?.theme}
          />
        </Field>

        <Field
          label="Tagline"
          name="tagline"
          hint="One sentence of plain description, shown beneath the theme."
          error={errors?.tagline}
        >
          <Input
            name="tagline"
            defaultValue={defaults?.tagline ?? ''}
            error={errors?.tagline}
          />
        </Field>
      </fieldset>

      {/* ── When and where ──────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          When and where
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          {/*
            Times, not dates. The agenda works out which day of the forum a
            session falls on by comparing it with the start below, and the
            opening and closing times are what a delegate books flights around.
            Everything is Freetown time, which is GMT the year round.
          */}
          <Field
            label="Opens"
            name="startDate"
            hint="Freetown time"
            error={errors?.startDate}
            required
          >
            <Input
              name="startDate"
              type="datetime-local"
              defaultValue={defaults?.startDate ?? ''}
              required
              error={errors?.startDate}
            />
          </Field>

          <Field
            label="Closes"
            name="endDate"
            hint="Freetown time"
            error={errors?.endDate}
            required
          >
            <Input
              name="endDate"
              type="datetime-local"
              defaultValue={defaults?.endDate ?? ''}
              required
              error={errors?.endDate}
            />
          </Field>
        </div>

        <Field
          label="Venue"
          name="venueName"
          error={errors?.venueName}
          required
        >
          <Input
            name="venueName"
            defaultValue={defaults?.venueName ?? ''}
            placeholder="Bintumani Conference Centre"
            required
            error={errors?.venueName}
          />
        </Field>

        <Field
          label="Address"
          name="venueAddress"
          error={errors?.venueAddress}
          required
        >
          <Input
            name="venueAddress"
            defaultValue={defaults?.venueAddress ?? ''}
            placeholder="Aberdeen, Freetown"
            required
            error={errors?.venueAddress}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="City" name="city" error={errors?.city}>
            <Input
              name="city"
              defaultValue={defaults?.city ?? 'Freetown'}
              error={errors?.city}
            />
          </Field>

          <Field label="Country" name="country" error={errors?.country}>
            <Input
              name="country"
              defaultValue={defaults?.country ?? 'Sierra Leone'}
              error={errors?.country}
            />
          </Field>
        </div>

        <Field
          label="Directions link"
          name="venueMapUrl"
          hint="A map link delegates can open on a handset — the venue page links to it as “Directions to the venue”."
          error={errors?.venueMapUrl}
        >
          <Input
            name="venueMapUrl"
            type="url"
            placeholder="https://maps.google.com/?q="
            defaultValue={defaults?.venueMapUrl ?? ''}
            error={errors?.venueMapUrl}
          />
        </Field>

        {/*
          The map draws a pin only when both numbers are present, so leaving
          them blank is a supported answer rather than an omission — the venue
          page then shows the address and the directions link alone.
        */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Latitude"
            name="venueLat"
            hint="Optional. Both are needed to draw the map."
            error={errors?.venueLat}
          >
            <Input
              name="venueLat"
              inputMode="decimal"
              placeholder="8.4855"
              defaultValue={defaults?.venueLat ?? ''}
              error={errors?.venueLat}
            />
          </Field>

          <Field label="Longitude" name="venueLng" error={errors?.venueLng}>
            <Input
              name="venueLng"
              inputMode="decimal"
              placeholder="-13.2789"
              defaultValue={defaults?.venueLng ?? ''}
              error={errors?.venueLng}
            />
          </Field>
        </div>
      </fieldset>

      {/* ── What it says about itself ───────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          What it says about itself
        </legend>

        <Field
          label="Description"
          name="description"
          hint="A few paragraphs for the top of the forum overview page."
          error={errors?.description}
        >
          <Textarea
            name="description"
            rows={8}
            defaultValue={defaults?.description ?? ''}
            error={errors?.description}
          />
        </Field>

        <Field
          label="Objectives"
          name="objectives"
          hint="One per line. They are listed on the forum overview page in this order."
          error={errors?.objectives}
        >
          <Textarea
            name="objectives"
            rows={6}
            defaultValue={defaults?.objectives ?? ''}
            placeholder={
              'Connect Sierra Leonean enterprise with growth capital\nShowcase investable sectors'
            }
            error={errors?.objectives}
          />
        </Field>

        <Field
          label="Expected delegates"
          name="expectedDelegates"
          hint="Shown on the venue and overview pages. Leave blank to say nothing rather than to claim none."
          error={errors?.expectedDelegates}
          className="max-w-48"
        >
          <Input
            name="expectedDelegates"
            inputMode="numeric"
            placeholder="1200"
            defaultValue={defaults?.expectedDelegates ?? ''}
            error={errors?.expectedDelegates}
          />
        </Field>

        <Field
          label="Hero image"
          name="heroImageUrl"
          hint="A path on this site such as /brand/hero/one.jpg, or a full address elsewhere."
          error={errors?.heroImageUrl}
        >
          <UploadField
            name="heroImageUrl"
            kind="image"
            enabled={uploadsEnabled}
            defaultValue={defaults?.heroImageUrl ?? ''}
            placeholder="/brand/hero/opening.jpg"
            error={errors?.heroImageUrl}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Brochure"
            name="brochureUrl"
            hint="Pinned to the top of the downloads page."
            error={errors?.brochureUrl}
          >
            <Input
              name="brochureUrl"
              defaultValue={defaults?.brochureUrl ?? ''}
              placeholder="/downloads/brochure.pdf"
              error={errors?.brochureUrl}
            />
          </Field>

          <Field
            label="Sponsorship prospectus"
            name="prospectusUrl"
            hint="Linked from the sponsors page."
            error={errors?.prospectusUrl}
          >
            <Input
              name="prospectusUrl"
              defaultValue={defaults?.prospectusUrl ?? ''}
              placeholder="/downloads/prospectus.pdf"
              error={errors?.prospectusUrl}
            />
          </Field>
        </div>
      </fieldset>

      {/* ── Whether it is on ────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          Whether it is on
        </legend>

        <Checkbox
          name="isPublished"
          defaultChecked={defaults?.isPublished ?? true}
          label={
            <>
              Show on the public site
              <span className="mt-0.5 block text-ink-500">
                Unticking this is how a forum is withdrawn. Nothing is deleted —
                its programme, its delegates and its payments stay exactly as
                they are.
              </span>
            </>
          }
        />

        <Checkbox
          name="registrationOpen"
          defaultChecked={defaults?.registrationOpen ?? true}
          label={
            <>
              Registration is open
              <span className="mt-0.5 block text-ink-500">
                Closing registration stops new bookings being taken and nothing
                else — the programme and the delegates already booked are
                untouched.
              </span>
            </>
          }
        />

        <Checkbox
          name="isCurrent"
          defaultChecked={defaults?.isCurrent ?? false}
          label={
            <>
              This is the forum the site promotes
              <span className="mt-0.5 block text-ink-500">
                Only one forum can be current, so ticking this takes the flag
                off whichever forum holds it now. It is ignored while the forum
                is unpublished.
              </span>
            </>
          }
        />
      </fieldset>

      <div className="border-t border-ink-200 pt-6">
        <SubmitButton size="md" pendingLabel="Saving…">
          {defaults ? 'Save changes' : 'Create forum'}
        </SubmitButton>
      </div>
    </form>
  )
}
