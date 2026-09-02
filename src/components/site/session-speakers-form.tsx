'use client'

import { useActionState } from 'react'

import { Avatar } from '@/components/ui/card'
import {
  Field,
  FormMessage,
  Select,
  SubmitButton,
} from '@/components/ui/form'
import {
  addSessionSpeaker,
  removeSessionSpeaker,
} from '@/lib/actions/admin-programme'
import { idleState } from '@/lib/actions/types'
import { SPEAKER_ROLE_LABELS, SpeakerRole } from '@/lib/enums'
import { initials } from '@/lib/format'

/**
 * The line-up on one session (§4.5, §4.6).
 *
 * Building a panel is adding one person at a time, so that is what this is: a
 * name, the part they are playing, and a button. Not a multi-select — the role
 * differs per person, and a multi-select cannot carry it.
 *
 * Order is the order they were added, which is nearly always the order they
 * should be listed in, and the panel says so rather than offering a number
 * field that would be got wrong more often than it was got right. Reordering
 * is remove-and-re-add.
 *
 * The dropdown lists everyone not already on the session, published or not — a
 * speaker who has not been announced yet is exactly the person being scheduled
 * into a programme that has not been announced either.
 */

export type LineUpEntry = {
  speakerId: string
  fullName: string
  title: string
  organisation: string
  photoUrl: string | null
  role: string
}

export function SessionSpeakers({
  sessionId,
  lineUp,
  available,
}: {
  sessionId: string
  lineUp: LineUpEntry[]
  available: { id: string; fullName: string; organisation: string }[]
}) {
  return (
    <div className="space-y-6">
      {lineUp.length === 0 ? (
        <p className="text-sm text-ink-600">
          Nobody on this session yet. Sessions without speakers still appear on
          the agenda — a break or a networking slot needs none.
        </p>
      ) : (
        <ol className="divide-y divide-ink-100">
          {lineUp.map((entry, index) => (
            <li
              key={entry.speakerId}
              className="flex flex-wrap items-center gap-4 py-3 first:pt-0"
            >
              <span className="w-5 shrink-0 text-sm tabular-nums text-ink-400">
                {index + 1}
              </span>

              <Avatar
                src={entry.photoUrl}
                name={entry.fullName}
                initials={initials(entry.fullName)}
                size="sm"
              />

              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink-950">{entry.fullName}</p>
                <p className="truncate text-sm text-ink-600">
                  {entry.title}, {entry.organisation}
                </p>
              </div>

              <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-500">
                {SPEAKER_ROLE_LABELS[entry.role as SpeakerRole] ?? entry.role}
              </span>

              <RemoveSpeaker
                sessionId={sessionId}
                speakerId={entry.speakerId}
                fullName={entry.fullName}
              />
            </li>
          ))}
        </ol>
      )}

      <div className="border-t border-ink-200 pt-6">
        <AddSpeaker sessionId={sessionId} available={available} />
      </div>
    </div>
  )
}

function AddSpeaker({
  sessionId,
  available,
}: {
  sessionId: string
  available: { id: string; fullName: string; organisation: string }[]
}) {
  const [state, formAction] = useActionState(addSessionSpeaker, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  if (available.length === 0) {
    return (
      <p className="text-sm text-ink-600">
        Everyone on the speaker list is already on this session. Add a new
        speaker first, then come back.
      </p>
    )
  }

  return (
    /* Keyed on the success message so the selects reset after each addition. */
    <form
      key={state.status === 'success' ? state.message : 'add'}
      action={formAction}
      className="space-y-4"
    >
      <input type="hidden" name="sessionId" value={sessionId} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Speaker" name="speakerId" error={errors?.speakerId}>
          <Select name="speakerId" defaultValue="" error={errors?.speakerId}>
            <option value="" disabled>
              Choose a speaker
            </option>
            {available.map((speaker) => (
              <option key={speaker.id} value={speaker.id}>
                {speaker.fullName} — {speaker.organisation}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Their part" name="role" error={errors?.role}>
          <Select
            name="role"
            defaultValue={SpeakerRole.SPEAKER}
            error={errors?.role}
          >
            {Object.values(SpeakerRole).map((role) => (
              <option key={role} value={role}>
                {SPEAKER_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <SubmitButton variant="outline" size="sm" pendingLabel="Adding…">
        Add to the line-up
      </SubmitButton>
    </form>
  )
}

function RemoveSpeaker({
  sessionId,
  speakerId,
  fullName,
}: {
  sessionId: string
  speakerId: string
  fullName: string
}) {
  const [state, formAction] = useActionState(removeSessionSpeaker, idleState)

  return (
    <div className="shrink-0">
      <form action={formAction}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="speakerId" value={speakerId} />

        <SubmitButton
          variant="ghost"
          size="sm"
          className="text-red-700 hover:bg-red-50"
          pendingLabel="Removing…"
        >
          <span className="sr-only">Remove {fullName} from this session</span>
          <span aria-hidden="true">Remove</span>
        </SubmitButton>
      </form>

      {state.status === 'error' && state.message && (
        <p className="mt-1 text-sm text-red-700">{state.message}</p>
      )}
    </div>
  )
}
