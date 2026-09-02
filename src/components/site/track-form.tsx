'use client'

import { useActionState } from 'react'

import { Field, FormMessage, Input, SubmitButton } from '@/components/ui/form'
import { deleteTrack, saveTrack } from '@/lib/actions/admin-programme'
import { idleState } from '@/lib/actions/types'

/**
 * Tracks (§4.5).
 *
 * A track is three fields — a name, a colour and a place in the filter bar —
 * so each one is edited in place in the list rather than on a page of its own.
 * Navigating away and back to change "Finance" to "Finance & Investment" would
 * be more ceremony than the edit deserves, and the whole set is usually being
 * looked at together when any one of them is wrong.
 *
 * Each row is its own component because each row is its own form with its own
 * pending and error state. One shared state across the list would light up
 * every row when one of them failed.
 */

export type TrackRow = {
  id: string
  name: string
  colour: string
  sortOrder: number
  sessionCount: number
}

export function TrackManager({
  eventId,
  tracks,
}: {
  eventId: string
  tracks: TrackRow[]
}) {
  return (
    <div className="space-y-6">
      {tracks.length > 0 && (
        <ul className="divide-y divide-ink-100">
          {tracks.map((track) => (
            <li key={track.id} className="py-5 first:pt-0">
              <ExistingTrack eventId={eventId} track={track} />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-ink-200 pt-6">
        <p className="mb-4 font-display text-base font-semibold text-ink-950">
          Add a track
        </p>
        <NewTrack eventId={eventId} />
      </div>
    </div>
  )
}

/** The fields shared by both forms — one definition, so they cannot diverge. */
function TrackFields({
  defaults,
  errors,
}: {
  defaults?: Pick<TrackRow, 'name' | 'colour' | 'sortOrder'>
  errors?: Record<string, string>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
      <Field label="Name" name="name" error={errors?.name} required>
        <Input
          name="name"
          defaultValue={defaults?.name ?? ''}
          placeholder="Finance & Investment"
          required
          error={errors?.name}
        />
      </Field>

      <Field
        label="Colour"
        name="colour"
        hint="Shown beside sessions"
        error={errors?.colour}
      >
        <Input
          name="colour"
          type="color"
          defaultValue={defaults?.colour ?? '#0F7A3D'}
          error={errors?.colour}
          className="h-11 w-20 p-1"
        />
      </Field>

      <Field
        label="Order"
        name="sortOrder"
        hint="Low first"
        error={errors?.sortOrder}
      >
        <Input
          name="sortOrder"
          type="number"
          min={0}
          max={9999}
          defaultValue={defaults?.sortOrder ?? 0}
          error={errors?.sortOrder}
          className="w-24"
        />
      </Field>
    </div>
  )
}

function NewTrack({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState(saveTrack, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    /*
      Keyed on the success message so a saved form resets to blank fields —
      otherwise the track just added stays typed into the "add" row and invites
      being added twice.
    */
    <form
      key={state.status === 'success' ? state.message : 'new'}
      action={formAction}
      className="space-y-4"
    >
      <input type="hidden" name="eventId" value={eventId} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <TrackFields errors={errors} />

      <SubmitButton variant="outline" size="sm" pendingLabel="Adding…">
        Add track
      </SubmitButton>
    </form>
  )
}

function ExistingTrack({
  eventId,
  track,
}: {
  eventId: string
  track: TrackRow
}) {
  const [saveState, saveAction] = useActionState(saveTrack, idleState)
  const [deleteState, deleteAction] = useActionState(deleteTrack, idleState)

  const errors = saveState.status === 'error' ? saveState.errors : undefined

  return (
    <div className="space-y-4">
      {saveState.status === 'success' && (
        <FormMessage status="success">{saveState.message}</FormMessage>
      )}

      {saveState.status === 'error' && saveState.message && !errors && (
        <FormMessage status="error">{saveState.message}</FormMessage>
      )}

      {deleteState.status === 'error' && deleteState.message && (
        <FormMessage status="error">{deleteState.message}</FormMessage>
      )}

      <form action={saveAction} className="space-y-4">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="trackId" value={track.id} />

        <TrackFields defaults={track} errors={errors} />

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
            Save
          </SubmitButton>

          <p className="text-sm text-ink-500">
            {track.sessionCount === 0
              ? 'No sessions on this track yet'
              : `${track.sessionCount} session${track.sessionCount === 1 ? '' : 's'}`}
          </p>
        </div>
      </form>

      {/*
        A separate form, not a second submit button on the one above: removing
        a track must not carry the half-typed edits sitting in those fields.
      */}
      <form action={deleteAction}>
        <input type="hidden" name="trackId" value={track.id} />

        <RemoveTrackButton
          name={track.name}
          sessionCount={track.sessionCount}
        />
      </form>
    </div>
  )
}

/**
 * Removal, with the consequence written beside the control rather than behind
 * it.
 *
 * No `confirm()` dialog: the sentence next to the button already carries the
 * fact a dialog would have been carrying, and it carries it before the click
 * rather than after.
 */
function RemoveTrackButton({
  name,
  sessionCount,
}: {
  name: string
  sessionCount: number
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <SubmitButton
        variant="ghost"
        size="sm"
        className="text-red-700 hover:bg-red-50"
        pendingLabel="Removing…"
      >
        Remove {name}
      </SubmitButton>

      {sessionCount > 0 && (
        <span className="text-sm text-ink-500">
          Its {sessionCount} session{sessionCount === 1 ? '' : 's'} stay on the
          programme, with no track.
        </span>
      )}
    </div>
  )
}
