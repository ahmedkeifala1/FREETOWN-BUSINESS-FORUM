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
import { deleteSession, saveSession } from '@/lib/actions/admin-programme'
import { idleState } from '@/lib/actions/types'
import { SESSION_TYPE_LABELS, SessionType } from '@/lib/enums'

/**
 * One session on the programme (§4.5, FR-01).
 *
 * The times are two `datetime-local` controls rather than a date plus two
 * times. It is one more character to type and it removes the case that
 * otherwise has to be handled somewhere: a session that runs past midnight.
 * The pair are read as UTC on the way in — see `utcDateTimeSchema` — which is
 * what makes the agenda show the time that was typed.
 *
 * There is no day-number field. The day is worked out from the start time
 * against the forum's own start date, so the day tabs on the agenda cannot
 * disagree with the dates printed under them.
 *
 * Removal sits at the foot of the form, below a rule, and is offered second to
 * unpublishing. A session pulled from the programme after delegates have
 * planned around it is usually better left published and rewritten.
 */

export type SessionDefaults = {
  id: string
  title: string
  slug: string
  description: string | null
  trackId: string | null
  /** Pre-formatted for `datetime-local` by the page — see `toDateTimeInput`. */
  startsAt: string
  endsAt: string
  room: string | null
  sessionType: string
  sortOrder: number
  isPublished: boolean
}

const SESSION_TYPES = Object.values(SessionType)

export function SessionForm({
  eventId,
  eventName,
  tracks,
  defaults,
  /** The forum's own dates, so the time fields open on the right week. */
  eventWindow,
}: {
  eventId: string
  eventName: string
  tracks: { id: string; name: string }[]
  defaults: SessionDefaults | null
  eventWindow: { min: string; max: string }
}) {
  const [state, formAction] = useActionState(saveSession, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-8">
        <input type="hidden" name="eventId" value={eventId} />
        {defaults && (
          <input type="hidden" name="sessionId" value={defaults.id} />
        )}

        <ErrorSummary errors={errors} />

        {state.status === 'success' && (
          <FormMessage status="success">{state.message}</FormMessage>
        )}

        {state.status === 'error' && state.message && !errors && (
          <FormMessage status="error">{state.message}</FormMessage>
        )}

        {/* ── The session ─────────────────────────────────────────────── */}

        <fieldset className="space-y-5">
          <legend className="font-display text-base font-semibold text-ink-950">
            The session
          </legend>

          <Field label="Title" name="title" error={errors?.title} required>
            <Input
              name="title"
              defaultValue={defaults?.title ?? ''}
              placeholder="Opening plenary: financing Sierra Leone's next decade"
              required
              error={errors?.title}
            />
          </Field>

          <Field
            label="Web address"
            name="slug"
            hint="Lower case, words separated by hyphens. It is the anchor a shared agenda link points at, so changing it on a published session breaks links already circulated."
            error={errors?.slug}
            required
          >
            <Input
              name="slug"
              defaultValue={defaults?.slug ?? ''}
              placeholder="opening-plenary"
              required
              error={errors?.slug}
            />
          </Field>

          <Field
            label="Description"
            name="description"
            hint="Shown when a delegate expands the row on the agenda. Leave it blank and the row does not expand."
            error={errors?.description}
          >
            <Textarea
              name="description"
              rows={6}
              defaultValue={defaults?.description ?? ''}
              error={errors?.description}
            />
          </Field>
        </fieldset>

        {/* ── When and where ──────────────────────────────────────────── */}

        <fieldset className="space-y-5">
          <legend className="font-display text-base font-semibold text-ink-950">
            When and where
          </legend>

          <p className="text-sm text-ink-600">
            Times are Freetown time. The day it appears under on the agenda is
            worked out from the date, so there is nothing else to set.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Starts"
              name="startsAt"
              error={errors?.startsAt}
              required
            >
              <Input
                name="startsAt"
                type="datetime-local"
                min={eventWindow.min}
                max={eventWindow.max}
                defaultValue={defaults?.startsAt ?? ''}
                required
                error={errors?.startsAt}
              />
            </Field>

            <Field label="Ends" name="endsAt" error={errors?.endsAt} required>
              <Input
                name="endsAt"
                type="datetime-local"
                min={eventWindow.min}
                max={eventWindow.max}
                defaultValue={defaults?.endsAt ?? ''}
                required
                error={errors?.endsAt}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Room"
              name="room"
              hint="Where in the venue"
              error={errors?.room}
            >
              <Input
                name="room"
                defaultValue={defaults?.room ?? ''}
                placeholder="Main auditorium"
                error={errors?.room}
              />
            </Field>

            <Field label="Track" name="trackId" error={errors?.trackId}>
              <Select
                name="trackId"
                defaultValue={defaults?.trackId ?? ''}
                error={errors?.trackId}
              >
                <option value="">No track — runs for everyone</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {tracks.length === 0 && (
            <p className="text-sm text-ink-600">
              {eventName} has no tracks yet. Sessions work perfectly well
              without them — add tracks only when the programme runs in
              parallel streams.
            </p>
          )}
        </fieldset>

        {/* ── How it is listed ────────────────────────────────────────── */}

        <fieldset className="space-y-5">
          <legend className="font-display text-base font-semibold text-ink-950">
            How it is listed
          </legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Type"
              name="sessionType"
              hint="Breaks and networking are shown in a quieter style, and appear on every track."
              error={errors?.sessionType}
              required
            >
              <Select
                name="sessionType"
                defaultValue={defaults?.sessionType ?? SessionType.PANEL}
                error={errors?.sessionType}
              >
                {SESSION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SESSION_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Order"
              name="sortOrder"
              hint="Only breaks a tie between sessions starting at the same minute."
              error={errors?.sortOrder}
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
          </div>

          <Checkbox
            name="isPublished"
            defaultChecked={defaults?.isPublished ?? true}
            label="Show on the public agenda"
          />
        </fieldset>

        <div className="border-t border-ink-200 pt-6">
          <SubmitButton size="md" pendingLabel="Saving…">
            {defaults ? 'Save changes' : 'Add to the programme'}
          </SubmitButton>
        </div>
      </form>

      {defaults && <RemoveSession sessionId={defaults.id} />}
    </div>
  )
}

/**
 * Taking a session off the programme entirely.
 *
 * Its own form below a rule, so it is never the button a hurried hand lands on
 * next to "Save changes", and never carries unsaved edits with it.
 */
function RemoveSession({ sessionId }: { sessionId: string }) {
  const [state, formAction] = useActionState(deleteSession, idleState)

  return (
    <div className="border-t border-ink-200 pt-6">
      {state.status === 'error' && state.message && (
        <div className="mb-4">
          <FormMessage status="error">{state.message}</FormMessage>
        </div>
      )}

      <form action={formAction}>
        <input type="hidden" name="sessionId" value={sessionId} />

        <SubmitButton
          variant="ghost"
          size="sm"
          className="text-red-700 hover:bg-red-50"
          pendingLabel="Removing…"
        >
          Remove this session
        </SubmitButton>
      </form>

      <p className="mt-2 max-w-prose text-sm text-ink-600">
        Deletes it and its line-up for good. If the session is cancelled rather
        than a mistake, untick “Show on the public agenda” instead — or leave it
        up and say in the description what happened, so delegates who planned
        around it find out why.
      </p>
    </div>
  )
}
