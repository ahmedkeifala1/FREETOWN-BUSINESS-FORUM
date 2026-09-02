'use server'

import { revalidatePath } from 'next/cache'

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { MemberStatus } from '@/lib/enums'
import { slugify } from '@/lib/format'
import { directoryListingSchema, parseForm } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * A member managing their own directory entry (§4.11, §4.16, FR-10).
 *
 * Two rules run through everything here.
 *
 * The listing is found from the session's member id, never from an id in the
 * form. A form that carried the listing id would let any signed-in member
 * rewrite any other member's entry by changing one hidden field, and the
 * directory is the part of this site that businesses are judged on.
 *
 * Publishing needs an ACTIVE membership. Editing does not — a pending
 * applicant can write their entry while the secretariat vets them, which is
 * the natural moment to do it, but nothing reaches the public directory until
 * the membership behind it is real and paid.
 */

type MyMember = {
  id: string
  status: string
  organisationName: string
  listing: { id: string; slug: string; isPublished: boolean } | null
}

/**
 * The caller's own listing, or a reason there isn't one.
 *
 * Discriminated on `ok` rather than on the presence of a key: a union of two
 * object literals gets each other's keys added back as optional-undefined, so
 * `'error' in result` does not narrow it.
 */
type MyListingResult =
  | { ok: false; error: string }
  | { ok: true; member: MyMember }

async function myListing(): Promise<MyListingResult> {
  const user = await getCurrentUser()

  if (!user) return { ok: false, error: 'You must be signed in to do that.' }
  if (!user.memberId) {
    return {
      ok: false,
      error:
        'Only members have a directory listing. Apply for membership first.',
    }
  }

  const member = await db.member.findUnique({
    where: { id: user.memberId },
    select: {
      id: true,
      status: true,
      organisationName: true,
      listing: { select: { id: true, slug: true, isPublished: true } },
    },
  })

  if (!member) {
    return { ok: false, error: 'We could not find your membership.' }
  }

  return { ok: true, member }
}

/** A slug that is free, ignoring the listing that already holds it. */
async function uniqueSlug(businessName: string, exceptId?: string) {
  const base = slugify(businessName) || 'member'

  for (let attempt = 0; attempt < 25; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`
    const clash = await db.directoryListing.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!clash || clash.id === exceptId) return slug
  }

  return `${base}-${Date.now().toString(36)}`
}

export async function updateMyListing(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const found = await myListing()

  if (!found.ok) return errorState(found.error)

  const parsed = parseForm(directoryListingSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const { member } = found

  // The public URL only moves when the business name does. A slug that
  // followed every edit would break links members have already sent out.
  const slug =
    member.listing && member.listing.slug.startsWith(slugify(data.businessName))
      ? member.listing.slug
      : await uniqueSlug(data.businessName, member.listing?.id)

  const values = {
    businessName: data.businessName,
    sectorId: data.sectorId || null,
    region: data.region || null,
    size: data.size || null,
    shortDescription: data.shortDescription,
    fullDescription: data.fullDescription || null,
    logoUrl: data.logoUrl || null,
    website: data.website || null,
    contactEmail: data.contactEmail || null,
    contactPhone: data.contactPhone || null,
    address: data.address || null,
    yearFounded: data.yearFounded ?? null,
    employees: data.employees ?? null,
  }

  try {
    await db.directoryListing.upsert({
      where: { memberId: member.id },
      create: { memberId: member.id, slug, isPublished: false, ...values },
      update: { slug, ...values },
    })
  } catch {
    return errorState(
      'We could not save your listing just now. Please try again shortly.',
    )
  }

  revalidatePath('/portal/listing')
  revalidatePath('/directory')
  if (member.listing?.slug) revalidatePath(`/directory/${member.listing.slug}`)
  revalidatePath(`/directory/${slug}`)

  return successState('Your listing has been saved.')
}

export async function setMyListingVisibility(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const found = await myListing()

  if (!found.ok) return errorState(found.error)

  const { member } = found

  if (!member.listing) {
    return errorState('Write your listing first, then publish it.')
  }

  const publish = formData.get('publish') === 'true'

  if (publish && member.status !== MemberStatus.ACTIVE) {
    return errorState(
      'Your listing goes live once your membership is active. The secretariat will be in touch — nothing more is needed from you.',
    )
  }

  await db.directoryListing.update({
    where: { id: member.listing.id },
    data: { isPublished: publish },
  })

  revalidatePath('/portal/listing')
  revalidatePath('/directory')
  revalidatePath(`/directory/${member.listing.slug}`)

  return successState(
    publish
      ? 'Your listing is live in the business directory.'
      : 'Your listing has been hidden from the public directory.',
  )
}
