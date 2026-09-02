'use client'

import { useActionState } from 'react'

import {
  Checkbox,
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { deleteSpeaker, saveSpeaker } from '@/lib/actions/admin-programme'
import { idleState } from '@/lib/actions/types'

/**
 * A speaker profile (§4.6).
 *
 * Speakers are not tied to an event: the same minister opens two forums
 * running, and a per-event copy would mean two biographies to correct and two
 * photographs to replace. What ties them to a forum is the sessions they are
 * put on, which is done from the session rather than from here.
 *
 * "Featured" and "published" are separate switches because they answer
 * different questions. Published decides whether the profile exists to the
 * public at all; featured decides whether they are one of the faces on the
 * homepage wall. An unpublished speaker who is ticked as featured is not a
 * contradiction to resolve here — the wall reads published speakers only, and
 * the tick is simply waiting for the announcement.
 */

export type SpeakerDefaults = {
  id: string
  fullName: string
  slug: string
  title: string
  organisation: string
  bio: string | null
  photoUrl: string | null
  country: string | null
  sectorId: string | null
  linkedinUrl: string | null
  twitterUrl: string | null
  websiteUrl: string | null
  sortOrder: number
  isFeatured: boolean
  isPublished: boolean
  /** How many sessions they are on — removal is refused while this is above 0. */
  sessionCount: number
}

export function SpeakerForm({
  sectors,
  defaults,
}: {
  sectors: { id: string; name: string }[]
  defaults: SpeakerDefaults | null
}) {
  const [state, formAction] = useActionState(saveSpeaker, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-8">
        {defaults && (
          <input type="hidden" name="speakerId" value={defaults.id} />
        )}

        <ErrorSummary errors={errors} />

        {state.status === 'success' && (
          <FormMessage status="success">{state.message}</FormMessage>
        )}

        {state.status === 'error' && state.message && !errors && (
          <FormMessage status="error">{state.message}</FormMessage>
        )}

        {/* ── Who they are ────────────────────────────────────────────── */}

        <fieldset className="space-y-5">
          <legend className="font-display text-base font-semibold text-ink-950">
            Who they are
          </legend>

          <Field
            label="Full name"
            name="fullName"
            hint="As it should appear on the programme, with any honorific they use."
            error={errors?.fullName}
            required
          >
            <Input
              name="fullName"
              defaultValue={defaults?.fullName ?? ''}
              required
              error={errors?.fullName}
            />
          </Field>

          <Field
            label="Web address"
            name="slug"
            hint="Their page is /events/speakers/this. Changing it on an announced speaker breaks links already shared."
            error={errors?.slug}
            required
          >
            <Input
              name="slug"
              defaultValue={defaults?.slug ?? ''}
              placeholder="aminata-koroma"
              required
              error={errors?.slug}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Job title"
              name="title"
              error={errors?.title}
              required
            >
              <Input
                name="title"
                defaultValue={defaults?.title ?? ''}
                placeholder="Deputy Governor"
                required
                error={errors?.title}
              />
            </Field>

            <Field
              label="Organisation"
              name="organisation"
              error={errors?.organisation}
              required
            >
              <Input
                name="organisation"
                defaultValue={defaults?.organisation ?? ''}
                placeholder="Bank of Sierra Leone"
                required
                error={errors?.organisation}
              />
            </Field>
          </div>

          <Field
            label="Biography"
            name="bio"
            hint="A few paragraphs, written in the third person. It is the whole of their speaker page."
            error={errors?.bio}
          >
            <Textarea
              name="bio"
              rows={10}
              defaultValue={defaults?.bio ?? ''}
              error={errors?.bio}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Country" name="country" error={errors?.country}>
              <Input
                name="country"
                defaultValue={defaults?.country ?? ''}
                placeholder="Sierra Leone"
                error={errors?.country}
              />
            </Field>

            <Field
              label="Sector"
              name="sectorId"
              hint="Groups them on the speakers page"
              error={errors?.sectorId}
            >
              <Select
                name="sectorId"
                defaultValue={defaults?.sectorId ?? ''}
                error={errors?.sectorId}
              >
                <option value="">No sector</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        {/* ── Photograph and links ────────────────────────────────────── */}

        <fieldset className="space-y-5">
          <legend className="font-display text-base font-semibold text-ink-950">
            Photograph and links
          </legend>

          <Field
            label="Photograph URL"
            name="photoUrl"
            hint="A square portrait reads best — the wall and the agenda both crop to a square. Without one, their initials are shown."
            error={errors?.photoUrl}
          >
            <Input
              name="photoUrl"
              type="url"
              placeholder="https://"
              defaultValue={defaults?.photoUrl ?? ''}
              error={errors?.photoUrl}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="LinkedIn" name="linkedinUrl" error={errors?.linkedinUrl}>
              <Input
                name="linkedinUrl"
                type="url"
                placeholder="https://"
                defaultValue={defaults?.linkedinUrl ?? ''}
                error={errors?.linkedinUrl}
              />
            </Field>

            <Field label="X / Twitter" name="twitterUrl" error={errors?.twitterUrl}>
              <Input
                name="twitterUrl"
                type="url"
                placeholder="https://"
                defaultValue={defaults?.twitterUrl ?? ''}
                error={errors?.twitterUrl}
              />
            </Field>

            <Field label="Website" name="websiteUrl" error={errors?.websiteUrl}>
              <Input
                name="websiteUrl"
                type="url"
                placeholder="https://"
                defaultValue={defaults?.websiteUrl ?? ''}
                error={errors?.websiteUrl}
              />
            </Field>
          </div>
        </fieldset>

        {/* ── How they are shown ──────────────────────────────────────── */}

        <fieldset className="space-y-5">
          <legend className="font-display text-base font-semibold text-ink-950">
            How they are shown
          </legend>

          <Field
            label="Order"
            name="sortOrder"
            hint="Low first, on the speakers page and the homepage wall."
            error={errors?.sortOrder}
            className="max-w-40"
          >
            <Input
              name="sortOrder"
              type="number"
              min={0}
              max={9999}
              defaultValue={defaults?.sortOrder ?? 0}
              error={errors?.sortOrder}
            />
          </Field>

          <Checkbox
            name="isFeatured"
            defaultChecked={defaults?.isFeatured}
            label="Feature on the homepage speaker wall"
          />

          <Checkbox
            name="isPublished"
            defaultChecked={defaults?.isPublished ?? true}
            label="Show on the public site"
          />
        </fieldset>

        <div className="border-t border-ink-200 pt-6">
          <SubmitButton size="md" pendingLabel="Saving…">
            {defaults ? 'Save changes' : 'Add speaker'}
          </SubmitButton>
        </div>
      </form>

      {defaults && (
        <RemoveSpeaker
          speakerId={defaults.id}
          sessionCount={defaults.sessionCount}
        />
      )}
    </div>
  )
}

/**
 * Deleting the profile outright.
 *
 * Not offered at all while they are on the programme — the action refuses it
 * anyway, and a button that is going to be refused is a button that should not
 * be drawn. The sentence in its place names the sessions as the thing to
 * settle first.
 */
function RemoveSpeaker({
  speakerId,
  sessionCount,
}: {
  speakerId: string
  sessionCount: number
}) {
  const [state, formAction] = useActionState(deleteSpeaker, idleState)

  if (sessionCount > 0) {
    return (
      <div className="border-t border-ink-200 pt-6">
        <p className="max-w-prose text-sm text-ink-600">
          This speaker is on {sessionCount} session
          {sessionCount === 1 ? '' : 's'}, so the profile cannot be deleted.
          Untick “Show on the public site” to hide it without touching the
          programme, or take them off those sessions first.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-ink-200 pt-6">
      {state.status === 'error' && state.message && (
        <div className="mb-4">
          <FormMessage status="error">{state.message}</FormMessage>
        </div>
      )}

      <form action={formAction}>
        <input type="hidden" name="speakerId" value={speakerId} />

        <SubmitButton
          variant="ghost"
          size="sm"
          className="text-red-700 hover:bg-red-50"
          pendingLabel="Removing…"
        >
          Delete this profile
        </SubmitButton>
      </form>

      <p className="mt-2 max-w-prose text-sm text-ink-600">
        They are on no sessions, so nothing on the programme changes. If they
        may return for a later forum, untick “Show on the public site” instead
        and the profile is kept.
      </p>
    </div>
  )
}
