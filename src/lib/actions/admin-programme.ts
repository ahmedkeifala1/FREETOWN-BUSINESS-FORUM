'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import { assertPermission, Permission } from '@/lib/rbac'
import {
  eventSessionSchema,
  parseForm,
  sessionSpeakerSchema,
  speakerSchema,
  trackSchema,
} from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Editing the programme: tracks, sessions and speakers (§4.5, §4.6, FR-01).
 *
 * Everything here is behind EVENT_MANAGE, which the Event manager and the
 * Administrator hold (§12). It is a single permission rather than an edit /
 * publish pair like articles: a session is not an opinion piece, and the
 * person trusted to schedule the forum is the person trusted to say the
 * schedule is final. `isPublished` is the control instead, and it is a
 * property of the session rather than of who saved it.
 *
 * Two rules shape the rest of this file.
 *
 * **A session's day is derived, never typed.** The agenda groups by
 * `dayNumber` and labels each tab from the first session's date, so a session
 * dated the 13th but marked day 1 puts "Wednesday" on the day-2 tab. Deriving
 * the number from the date against the event's start makes that unrepresentable
 * rather than merely discouraged.
 *
 * **Removal is never silent.** Deleting a track leaves its sessions in place
 * and untracked; deleting a speaker who is on the programme is refused outright
 * and the manager is pointed at unpublishing instead. The destructive reading
 * of a delete is always the one a tired person clicks at eleven at night the
 * week before the forum.
 */

// ── Shared ──────────────────────────────────────────────────────────────────

/**
 * Every public surface the programme reaches.
 *
 * The homepage carries the session strip and the speaker wall, and the Learning
 * Hub carries the wall again, so a speaker edit is not just a speakers-page
 * change. Listing them here rather than at each call site is what stops the
 * next action from revalidating three of the five.
 */
function revalidateProgramme(speakerSlugs: string[] = []): void {
  revalidatePath('/')
  revalidatePath('/events')
  revalidatePath('/events/agenda')
  revalidatePath('/events/speakers')
  revalidatePath('/learning-hub')
  for (const slug of speakerSlugs) revalidatePath(`/events/speakers/${slug}`)
}

/**
 * Which day of the event a moment falls on, counting the start date as day 1.
 *
 * Compared on calendar dates in UTC rather than by subtracting timestamps: a
 * session at 09:00 on the second morning is day 2 even though it is 25 hours
 * after a 08:00 start on the first, and 23 hours after a 10:00 one.
 */
function dayNumberFor(startsAt: Date, eventStart: Date): number {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.floor((day(startsAt) - day(eventStart)) / 86_400_000) + 1
}

// ── Tracks ──────────────────────────────────────────────────────────────────

/**
 * Create or rename a track.
 *
 * Tracks have no slug and no public page of their own — they are a filter on
 * the agenda, addressed by id in the query string — so renaming one is safe and
 * breaks no links.
 */
export async function saveTrack(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(trackSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const trackId = String(formData.get('trackId') ?? '') || null

  if (trackId) {
    const existing = await db.track.findUnique({
      where: { id: trackId },
      select: { id: true },
    })
    if (!existing) return errorState('That track no longer exists.')
  }

  let saved: { id: string; name: string }

  try {
    saved = trackId
      ? await db.track.update({
          where: { id: trackId },
          data: {
            name: data.name,
            colour: data.colour,
            sortOrder: data.sortOrder,
          },
          select: { id: true, name: true },
        })
      : await db.track.create({
          data: {
            eventId: data.eventId,
            name: data.name,
            colour: data.colour,
            sortOrder: data.sortOrder,
          },
          select: { id: true, name: true },
        })
  } catch {
    return errorState('We could not save that track. Please try again shortly.')
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_UPDATE,
    entityType: 'Track',
    entityId: saved.id,
    summary: `${trackId ? 'Updated' : 'Created'} track "${saved.name}".`,
    metadata: { colour: data.colour, sortOrder: data.sortOrder },
  })

  revalidateProgramme()

  return successState(trackId ? 'Track saved.' : `Added the ${saved.name} track.`)
}

/**
 * Remove a track.
 *
 * The sessions on it survive, untracked — the relation is optional and nulls
 * on delete, which is the behaviour we want. A track is a way of grouping the
 * programme, and abandoning the grouping should not cancel eight sessions. The
 * count is reported back so the manager knows what just became untracked.
 */
export async function deleteTrack(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const trackId = String(formData.get('trackId') ?? '')
  if (!trackId) return errorState('No track was given.')

  const track = await db.track.findUnique({
    where: { id: trackId },
    select: { id: true, name: true, _count: { select: { sessions: true } } },
  })

  if (!track) return errorState('That track no longer exists.')

  try {
    await db.track.delete({ where: { id: track.id } })
  } catch {
    return errorState('We could not remove that track. Please try again shortly.')
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_DELETE,
    entityType: 'Track',
    entityId: track.id,
    summary: `Removed track "${track.name}" — ${track._count.sessions} session(s) left untracked.`,
    metadata: { sessions: track._count.sessions },
  })

  revalidateProgramme()

  return successState(
    track._count.sessions === 0
      ? `Removed the ${track.name} track.`
      : `Removed the ${track.name} track. Its ${track._count.sessions} session(s) are still on the programme, now with no track.`,
  )
}

// ── Sessions ────────────────────────────────────────────────────────────────

/** A session slug free within its event, ignoring the session that holds it. */
async function sessionSlugIsFree(
  eventId: string,
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const clash = await db.eventSession.findUnique({
    where: { eventId_slug: { eventId, slug } },
    select: { id: true },
  })
  return !clash || clash.id === exceptId
}

/**
 * Create or edit one session.
 *
 * The slug is the anchor the agenda gives each row (`#opening-plenary`), so it
 * is the address of a session inside a shared link. Changing it on a published
 * session breaks any such link that is already out; the form says so, and the
 * decision is left to the manager, who is the only one who knows whether the
 * programme has been circulated yet.
 */
export async function saveSession(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(eventSessionSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const sessionId = String(formData.get('sessionId') ?? '') || null

  const event = await db.event.findUnique({
    where: { id: data.eventId },
    select: { id: true, startDate: true, endDate: true },
  })

  if (!event) return errorState('That event no longer exists.')

  // Derived, not typed — see the note at the top of this file.
  const dayNumber = dayNumberFor(data.startsAt, event.startDate)

  if (dayNumber < 1) {
    return fieldErrors({
      startsAt: 'That is before the forum opens. Check the date.',
    })
  }

  if (!(await sessionSlugIsFree(event.id, data.slug, sessionId ?? undefined))) {
    return fieldErrors({
      slug: 'Another session at this forum already uses that web address.',
    })
  }

  // An empty <select> submits "", which is a track id of no track rather than
  // an invalid one.
  const trackId = data.trackId || null

  if (trackId) {
    const track = await db.track.findFirst({
      where: { id: trackId, eventId: event.id },
      select: { id: true },
    })
    // A track from another event would filter to nothing on the agenda and
    // read as a session that had quietly vanished.
    if (!track) {
      return fieldErrors({ trackId: 'That track is not on this programme.' })
    }
  }

  const existing = sessionId
    ? await db.eventSession.findUnique({
        where: { id: sessionId },
        select: { id: true, slug: true, isPublished: true },
      })
    : null

  if (sessionId && !existing) {
    return errorState('That session no longer exists.')
  }

  const values = {
    eventId: event.id,
    trackId,
    title: data.title,
    slug: data.slug,
    description: data.description,
    dayNumber,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    room: data.room,
    sessionType: data.sessionType,
    sortOrder: data.sortOrder,
    isPublished: data.isPublished,
  }

  let saved: { id: string; title: string }

  try {
    saved = existing
      ? await db.eventSession.update({
          where: { id: existing.id },
          data: values,
          select: { id: true, title: true },
        })
      : await db.eventSession.create({
          data: values,
          select: { id: true, title: true },
        })
  } catch {
    return errorState(
      'We could not save that session just now. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_UPDATE,
    entityType: 'EventSession',
    entityId: saved.id,
    summary: `${existing ? 'Updated' : 'Created'} session "${saved.title}" — day ${dayNumber}, ${data.isPublished ? 'published' : 'unpublished'}.`,
    metadata: {
      slug: data.slug,
      dayNumber,
      startsAt: data.startsAt.toISOString(),
      isPublished: data.isPublished,
    },
  })

  revalidateProgramme()

  // A new session gets its own address, so a refresh does not create a second
  // one and the speaker panel has somewhere to appear.
  if (!existing) redirect(`/admin/programme/${saved.id}`)

  return successState(
    data.isPublished
      ? 'Saved and on the public agenda.'
      : 'Saved. It is not on the public agenda yet.',
  )
}

/**
 * Remove a session from the programme.
 *
 * The speaker assignments go with it — they describe this session and nothing
 * else — but the Speaker rows themselves are untouched. Unpublishing is the
 * gentler option and the form offers it first; this is for a session that was
 * created in error, not one that was cancelled. A cancelled session is usually
 * better left published with its description rewritten, so delegates who
 * planned around it find out why.
 */
export async function deleteSession(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const sessionId = String(formData.get('sessionId') ?? '')
  if (!sessionId) return errorState('No session was given.')

  const session = await db.eventSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      title: true,
      slug: true,
      dayNumber: true,
      _count: { select: { speakers: true } },
    },
  })

  if (!session) return errorState('That session no longer exists.')

  try {
    await db.eventSession.delete({ where: { id: session.id } })
  } catch {
    return errorState(
      'We could not remove that session. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_DELETE,
    entityType: 'EventSession',
    entityId: session.id,
    summary: `Removed session "${session.title}" from day ${session.dayNumber}.`,
    metadata: {
      slug: session.slug,
      speakersUnassigned: session._count.speakers,
    },
  })

  revalidateProgramme()

  redirect('/admin/programme')
}

// ── Speakers on a session ───────────────────────────────────────────────────

/**
 * Put a speaker on a session.
 *
 * `sortOrder` is assigned as the next place in the line-up rather than asked
 * for. The order speakers are added in is the order a panel is built, and it is
 * almost always the order it should be listed in; a manager who disagrees can
 * remove and re-add. Asking for a number on every addition would be a field
 * filled in wrong more often than it was filled in usefully.
 */
export async function addSessionSpeaker(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(sessionSpeakerSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const { sessionId, speakerId, role } = parsed.data

  const [session, speaker] = await Promise.all([
    db.eventSession.findUnique({
      where: { id: sessionId },
      select: { id: true, title: true },
    }),
    db.speaker.findUnique({
      where: { id: speakerId },
      select: { id: true, fullName: true, slug: true },
    }),
  ])

  if (!session) return errorState('That session no longer exists.')
  if (!speaker) return fieldErrors({ speakerId: 'That speaker no longer exists.' })

  const already = await db.sessionSpeaker.findUnique({
    where: { sessionId_speakerId: { sessionId, speakerId } },
    select: { role: true },
  })

  if (already) {
    return fieldErrors({
      speakerId: `${speaker.fullName} is already on this session. Remove them first to change their role.`,
    })
  }

  const last = await db.sessionSpeaker.findFirst({
    where: { sessionId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })

  try {
    await db.sessionSpeaker.create({
      data: {
        sessionId,
        speakerId,
        role,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    })
  } catch {
    return errorState('We could not add that speaker. Please try again shortly.')
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_UPDATE,
    entityType: 'EventSession',
    entityId: session.id,
    summary: `Added ${speaker.fullName} to "${session.title}" as ${role.toLowerCase()}.`,
    metadata: { speakerId, role },
  })

  revalidateProgramme([speaker.slug])

  return successState(`${speaker.fullName} added to the line-up.`)
}

/** Take a speaker off a session. The Speaker record itself is untouched. */
export async function removeSessionSpeaker(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const sessionId = String(formData.get('sessionId') ?? '')
  const speakerId = String(formData.get('speakerId') ?? '')

  if (!sessionId || !speakerId) return errorState('No speaker was given.')

  const assignment = await db.sessionSpeaker.findUnique({
    where: { sessionId_speakerId: { sessionId, speakerId } },
    select: {
      role: true,
      session: { select: { title: true } },
      speaker: { select: { fullName: true, slug: true } },
    },
  })

  if (!assignment) return errorState('That speaker is not on this session.')

  try {
    await db.sessionSpeaker.delete({
      where: { sessionId_speakerId: { sessionId, speakerId } },
    })
  } catch {
    return errorState(
      'We could not remove that speaker. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_UPDATE,
    entityType: 'EventSession',
    entityId: sessionId,
    summary: `Removed ${assignment.speaker.fullName} from "${assignment.session.title}".`,
    metadata: { speakerId, role: assignment.role },
  })

  revalidateProgramme([assignment.speaker.slug])

  return successState(`${assignment.speaker.fullName} removed from the line-up.`)
}

// ── Speakers ────────────────────────────────────────────────────────────────

/** A speaker slug that is free, ignoring the speaker who already holds it. */
async function speakerSlugIsFree(
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  const clash = await db.speaker.findUnique({
    where: { slug },
    select: { id: true },
  })
  return !clash || clash.id === exceptId
}

/**
 * Create or edit a speaker.
 *
 * Speakers are not scoped to an event. The same minister opens two forums
 * running, and duplicating the profile would duplicate the biography, the
 * photograph and the corrections to both. The slug is their public address
 * (`/events/speakers/aminata-koroma`), so it is treated with the same care as
 * an article's.
 */
export async function saveSpeaker(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(speakerSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const speakerId = String(formData.get('speakerId') ?? '') || null

  if (!(await speakerSlugIsFree(data.slug, speakerId ?? undefined))) {
    return fieldErrors({
      slug: 'Another speaker already uses that web address.',
    })
  }

  const existing = speakerId
    ? await db.speaker.findUnique({
        where: { id: speakerId },
        select: { id: true, slug: true },
      })
    : null

  if (speakerId && !existing) {
    return errorState('That speaker no longer exists.')
  }

  const values = {
    fullName: data.fullName,
    slug: data.slug,
    title: data.title,
    organisation: data.organisation,
    bio: data.bio,
    photoUrl: data.photoUrl ?? null,
    country: data.country,
    sectorId: data.sectorId || null,
    linkedinUrl: data.linkedinUrl ?? null,
    twitterUrl: data.twitterUrl ?? null,
    websiteUrl: data.websiteUrl ?? null,
    sortOrder: data.sortOrder,
    isFeatured: data.isFeatured,
    isPublished: data.isPublished,
  }

  let saved: { id: string; slug: string; fullName: string }

  try {
    saved = existing
      ? await db.speaker.update({
          where: { id: existing.id },
          data: values,
          select: { id: true, slug: true, fullName: true },
        })
      : await db.speaker.create({
          data: values,
          select: { id: true, slug: true, fullName: true },
        })
  } catch {
    return errorState(
      'We could not save that speaker just now. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_UPDATE,
    entityType: 'Speaker',
    entityId: saved.id,
    summary: `${existing ? 'Updated' : 'Added'} speaker ${saved.fullName} — ${data.isPublished ? 'published' : 'unpublished'}.`,
    metadata: { slug: saved.slug, isPublished: data.isPublished },
  })

  // The old address as well, so a renamed speaker's former page stops serving
  // a stale profile.
  revalidateProgramme(
    existing && existing.slug !== saved.slug
      ? [saved.slug, existing.slug]
      : [saved.slug],
  )

  if (!existing) redirect(`/admin/speakers/${saved.id}`)

  return successState(
    data.isPublished ? 'Saved and live.' : 'Saved. Not shown publicly yet.',
  )
}

/**
 * Remove a speaker.
 *
 * Refused while they are on the programme. The database would happily cascade
 * the assignments away, and the result would be a panel quietly down to two
 * names with nothing to say which third one had gone. Unpublishing takes them
 * off the speakers page and leaves the programme intact, which is what is
 * actually wanted in every case except a profile created by mistake.
 */
export async function deleteSpeaker(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const speakerId = String(formData.get('speakerId') ?? '')
  if (!speakerId) return errorState('No speaker was given.')

  const speaker = await db.speaker.findUnique({
    where: { id: speakerId },
    select: {
      id: true,
      slug: true,
      fullName: true,
      _count: { select: { sessions: true } },
    },
  })

  if (!speaker) return errorState('That speaker no longer exists.')

  if (speaker._count.sessions > 0) {
    return errorState(
      `${speaker.fullName} is on ${speaker._count.sessions} session(s). Take them off those sessions first, or untick "Show on the public site" to hide the profile without changing the programme.`,
    )
  }

  try {
    await db.speaker.delete({ where: { id: speaker.id } })
  } catch {
    return errorState(
      'We could not remove that speaker. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.PROGRAMME_DELETE,
    entityType: 'Speaker',
    entityId: speaker.id,
    summary: `Removed speaker ${speaker.fullName}.`,
    metadata: { slug: speaker.slug },
  })

  revalidateProgramme([speaker.slug])

  redirect('/admin/speakers')
}
