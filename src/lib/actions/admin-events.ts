'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import { assertPermission, Permission } from '@/lib/rbac'
import { eventSchema, parseForm } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Editing the forum itself (§4.4, FR-01).
 *
 * The programme, the tickets, the sponsors and every registration hang off an
 * Event row, which until now was only ever written by the seed. This is the
 * screen that lets the secretariat run next year's forum without a developer:
 * change the dates, move the venue, open and close registration, and say which
 * forum the site is currently promoting.
 *
 * Three rules shape the file.
 *
 * **An event is never deleted.** It is the parent of registrations people paid
 * for and of a ledger that is append-only by design (FR-14), so deletion would
 * either fail on the foreign keys or take financial history with it.
 * Unpublishing takes a forum off the public site and leaves its record whole;
 * that is the only removal offered, and it is reversible.
 *
 * **Exactly one forum is current.** The schema says so and `getCurrentEvent`
 * relies on it, so ticking the flag here clears it everywhere else in the same
 * transaction rather than trusting whoever saves next to untick the old one.
 *
 * **A save revalidates the whole site.** The current forum is named in the
 * header of every page, so there is no shorter honest list of what a change to
 * it touches.
 */

/**
 * Everything a forum's details reach.
 *
 * `'layout'` rather than a list of routes: the header renders the event name on
 * every page and the registration flow reads its dates and its open/closed
 * flag, so a narrower list would be a list that is quietly wrong somewhere.
 */
function revalidateEvent(): void {
  revalidatePath('/', 'layout')
}

/**
 * Create or update a forum.
 *
 * The slug stays editable on an existing forum, unlike a speaker's or an
 * article's. An event has no page addressed by it — `/events` and its children
 * always render the current forum — so renaming one breaks no link that has
 * been shared.
 */
export async function saveEvent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(eventSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const eventId = String(formData.get('eventId') ?? '') || null

  const existing = eventId
    ? await db.event.findUnique({
        where: { id: eventId },
        select: { id: true, slug: true, isCurrent: true },
      })
    : null

  if (eventId && !existing) return errorState('That forum no longer exists.')

  const clash = await db.event.findFirst({
    where: {
      slug: data.slug,
      ...(existing ? { id: { not: existing.id } } : {}),
    },
    select: { id: true },
  })

  if (clash) {
    return fieldErrors({ slug: 'Another forum already uses that web address.' })
  }

  const values = {
    name: data.name,
    slug: data.slug,
    theme: data.theme,
    tagline: data.tagline ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    venueName: data.venueName,
    venueAddress: data.venueAddress,
    city: data.city,
    country: data.country,
    venueMapUrl: data.venueMapUrl ?? null,
    venueLat: data.venueLat ?? null,
    venueLng: data.venueLng ?? null,
    description: data.description ?? null,
    objectivesJson: JSON.stringify(data.objectives),
    expectedDelegates: data.expectedDelegates ?? null,
    heroImageUrl: data.heroImageUrl ?? null,
    brochureUrl: data.brochureUrl ?? null,
    prospectusUrl: data.prospectusUrl ?? null,
    // An unpublished forum cannot be the current one: the header would name a
    // forum whose own pages are not public. The two ticks are kept independent
    // in the form so that publishing it later restores what was meant.
    isCurrent: data.isCurrent && data.isPublished,
    isPublished: data.isPublished,
    registrationOpen: data.registrationOpen,
  }

  let saved: { id: string; name: string; slug: string }

  try {
    /*
      One transaction, and the demotion runs first.

      `isCurrent` has no unique constraint — SQLite cannot express "at most one
      true" — so the rule is held by writing rather than by the database.
      Clearing the others before setting this one means the site is never
      momentarily promoting two forums, which is the state `getCurrentEvent`
      resolves by picking whichever row the query happens to return first.
    */
    saved = await db.$transaction(async (tx) => {
      if (values.isCurrent) {
        await tx.event.updateMany({
          where: {
            isCurrent: true,
            ...(existing ? { id: { not: existing.id } } : {}),
          },
          data: { isCurrent: false },
        })
      }

      return existing
        ? tx.event.update({
            where: { id: existing.id },
            data: values,
            select: { id: true, name: true, slug: true },
          })
        : tx.event.create({
            data: values,
            select: { id: true, name: true, slug: true },
          })
    })
  } catch {
    return errorState(
      'We could not save that forum just now. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.EVENT_UPDATE,
    entityType: 'Event',
    entityId: saved.id,
    summary: `${existing ? 'Updated' : 'Created'} forum ${saved.name} — ${
      values.isPublished ? 'published' : 'unpublished'
    }, registration ${values.registrationOpen ? 'open' : 'closed'}${
      values.isCurrent ? ', now the current forum' : ''
    }.`,
    metadata: {
      slug: saved.slug,
      isCurrent: values.isCurrent,
      isPublished: values.isPublished,
      registrationOpen: values.registrationOpen,
    },
  })

  revalidateEvent()

  if (!existing) redirect(`/admin/events/${saved.id}`)

  // The two switches that change what a visitor can actually do are named back
  // rather than confirmed with a bare "Saved": an event manager who has just
  // closed registration should be told that registration is closed.
  const state = [
    values.isPublished ? 'Live on the site' : 'Not shown publicly',
    values.registrationOpen ? 'registration open' : 'registration closed',
  ].join(', ')

  return successState(`Saved. ${state}.`)
}

/**
 * Promote a forum to the one the site is currently showing.
 *
 * Offered from the list as well as from the form because it is the one change
 * that is made on its own — this year's forum ends and next year's takes over,
 * with nothing else about either record altered. Doing it here saves one flag
 * rather than resubmitting twenty fields to change it.
 */
export async function setCurrentEvent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.EVENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const eventId = String(formData.get('eventId') ?? '')

  if (!eventId) return errorState('Choose a forum first.')

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, isPublished: true },
  })

  if (!event) return errorState('That forum no longer exists.')

  if (!event.isPublished) {
    return errorState(
      'Publish this forum first — the header would otherwise name a forum whose pages are not public.',
    )
  }

  try {
    await db.$transaction([
      db.event.updateMany({
        where: { isCurrent: true, id: { not: event.id } },
        data: { isCurrent: false },
      }),
      db.event.update({ where: { id: event.id }, data: { isCurrent: true } }),
    ])
  } catch {
    return errorState('We could not change the current forum just now.')
  }

  await record({
    userId: staff.id,
    action: AuditAction.EVENT_UPDATE,
    entityType: 'Event',
    entityId: event.id,
    summary: `${event.name} is now the current forum.`,
    metadata: { isCurrent: true },
  })

  revalidateEvent()

  return successState(`${event.name} is now the forum the site promotes.`)
}
