'use server'

import { randomBytes } from 'node:crypto'

import { getCurrentUser, hashPassword } from '@/lib/auth'
import { db } from '@/lib/db'
import { MemberStatus, Role } from '@/lib/enums'
import { slugify } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { notifySecretariat, sendMembershipReceived } from '@/lib/notifications'
import { memberNumber } from '@/lib/reference'
import { membershipApplicationSchema, parseForm } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Membership application (SDR §4.10, FR-09).
 *
 * An application is not a purchase. It creates a Member row at PENDING and
 * stops — the secretariat vets the organisation before anything is invoiced,
 * because a directory entry carries the forum's name and a tier badge is worth
 * something only if it is checked. Activation and the first invoice happen in
 * the admin panel.
 *
 * The applicant gets an account so the portal has somewhere to sign them into
 * later, but no usable password: it is created from random bytes and never
 * shown to anyone. They set their own from the reset link that goes out when
 * the membership is activated. That way a public form can never set a password
 * on an address the sender does not control.
 */

/** A directory slug that is not already taken. */
async function uniqueListingSlug(businessName: string): Promise<string> {
  const base = slugify(businessName) || 'member'

  for (let attempt = 0; attempt < 25; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`
    const clash = await db.directoryListing.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!clash) return slug
  }

  return `${base}-${randomBytes(3).toString('hex')}`
}

/** A member number that is not already taken. */
async function uniqueMemberNumber(): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const memberNo = memberNumber()
    const clash = await db.member.findUnique({
      where: { memberNo },
      select: { id: true },
    })
    if (!clash) return memberNo
  }

  throw new Error('Could not allocate a member number.')
}

export async function submitMembershipApplication(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(membershipApplicationSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  // Not part of the schema — it is not data, it is a trap. Named away from
  // "website" because this form has a real website field.
  if (formData.get('company_url')) {
    return successState('Thank you — your application has been received.')
  }

  const data = parsed.data

  // The tier has to exist and still be on sale. A tier id from a form is a
  // suggestion from the browser, never a fact, and the fee quoted back to the
  // applicant is read from the row rather than accepted from the page.
  const tier = await db.membershipTier.findFirst({
    where: { id: data.tierId, isActive: true },
    select: { id: true, name: true, priceMinor: true, currency: true },
  })

  if (!tier) {
    return errorState(
      'That membership tier is no longer available. Please choose another tier and try again.',
    )
  }

  // ── Whose application is this? ──────────────────────────────────────────

  const signedIn = await getCurrentUser()

  // A signed-in applicant applies as themselves, whatever address they typed:
  // otherwise the form would let them attach a membership to another account.
  const existing = signedIn
    ? await db.user.findUnique({
        where: { id: signedIn.id },
        select: { id: true, member: { select: { id: true } } },
      })
    : await db.user.findUnique({
        where: { email: data.email },
        select: { id: true, member: { select: { id: true } } },
      })

  if (existing?.member) {
    return errorState(
      signedIn
        ? 'Your account already holds a membership. Renew it from your portal rather than applying again.'
        : 'That email address already holds a membership. Sign in to renew it rather than applying again.',
    )
  }

  if (!signedIn && existing) {
    // The address belongs to an account we cannot be sure the sender controls.
    // Attaching a membership to it here would be an account takeover with
    // extra steps.
    return errorState(
      'That email address already has an account. Please sign in first, then apply from your portal.',
    )
  }

  // ── Write the application ───────────────────────────────────────────────

  let memberNo: string
  let memberId: string

  try {
    memberNo = await uniqueMemberNumber()
    const slug = await uniqueListingSlug(data.organisationName)

    // Random, never disclosed — see the note at the top of this file.
    const unusablePassword = await hashPassword(
      randomBytes(32).toString('base64url'),
    )

    const member = await db.$transaction(async (tx) => {
      const userId =
        existing?.id ??
        (
          await tx.user.create({
            data: {
              email: data.email,
              passwordHash: unusablePassword,
              firstName: data.firstName,
              lastName: data.lastName,
              phone: data.phone,
              role: Role.MEMBER,
              isActive: true,
            },
            select: { id: true },
          })
        ).id

      const created = await tx.member.create({
        data: {
          userId,
          memberNo,
          tierId: tier.id,
          organisationName: data.organisationName,
          status: MemberStatus.PENDING,
        },
        select: { id: true },
      })

      // Seeded unpublished, so the secretariat has something to check and the
      // member something to edit rather than a blank form (§4.11).
      await tx.directoryListing.create({
        data: {
          memberId: created.id,
          slug,
          businessName: data.organisationName,
          sectorId: data.sectorId || null,
          region: data.region || null,
          size: data.size || null,
          shortDescription: data.shortDescription,
          website: data.website || null,
          contactEmail: data.email,
          contactPhone: data.phone,
          isPublished: false,
        },
      })

      return created
    })

    memberId = member.id
  } catch {
    return errorState(
      'We could not record your application just now. Please try again shortly, or email the secretariat directly.',
    )
  }

  // Both messages are best-effort: the application is already safe.
  try {
    await sendMembershipReceived({
      to: data.email,
      firstName: data.firstName,
      organisationName: data.organisationName,
      tierName: tier.name,
      memberId,
    })
  } catch {
    // Recorded and numbered; a failed acknowledgement is not the applicant's
    // problem.
  }

  const fee = isCurrency(tier.currency)
    ? formatMoney(tier.priceMinor, tier.currency)
    : String(tier.priceMinor)

  try {
    await notifySecretariat({
      subject: `New membership application — ${data.organisationName} (${tier.name})`,
      template: 'membership.application.staff',
      related: { type: 'Member', id: memberId },
      body: `A membership application has been submitted.

  Member no:    ${memberNo}
  Organisation: ${data.organisationName}
  Tier:         ${tier.name} — ${fee} a year
  Contact:      ${data.firstName} ${data.lastName} — ${data.email}, ${data.phone}
  Region:       ${data.region || 'not given'}

Vet it and activate the membership in the admin panel. A draft directory entry
has been created and is unpublished.`,
    })
  } catch {
    // Staff notification only.
  }

  return successState(
    `Thank you — your application has been received. Your reference is ${memberNo}, and a copy has been emailed to ${data.email}.`,
    { memberNo, tierName: tier.name },
  )
}
