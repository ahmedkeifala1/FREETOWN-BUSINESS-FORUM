'use server'

import { revalidatePath } from 'next/cache'

import { createPasswordResetToken } from '@/lib/auth'
import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  InvoiceStatus,
  MemberStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from '@/lib/enums'
import { formatMoney, isCurrency } from '@/lib/money'
import {
  sendEmail,
  sendMembershipActivated,
  sendPasswordReset,
} from '@/lib/notifications'
import { invoiceNumber, paymentReference } from '@/lib/reference'
import { assertPermission, Permission } from '@/lib/rbac'
import { memberStatusSchema } from '@/lib/validation'
import {
  errorState,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Membership administration (FR-09, §12).
 *
 * Activation is the action the whole membership module exists to reach, and it
 * does four things that have to happen together:
 *
 *  1. the member goes ACTIVE with a joined and an expiry date;
 *  2. an invoice is raised for the first period, so finance has something to
 *     reconcile the eventual transfer against;
 *  3. the member is told, and given a link to set a password — the account was
 *     created by a public form with a random one nobody knows (see
 *     lib/actions/membership.ts), so without this they can never sign in;
 *  4. the whole thing is written to the audit trail (§14).
 *
 * The first two are in a transaction. The last two are best-effort afterwards:
 * a membership that is active in the database but whose welcome email bounced
 * is a support call, whereas a half-activated membership is a data problem.
 */

function addMonths(date: Date, months: number): Date {
  const out = new Date(date)
  out.setMonth(out.getMonth() + months)
  return out
}

export async function activateMembership(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.MEMBERSHIP_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const memberId = String(formData.get('memberId') ?? '')

  if (!memberId) return errorState('No membership was named.')

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      memberNo: true,
      status: true,
      organisationName: true,
      expiresAt: true,
      tier: {
        select: {
          name: true,
          priceMinor: true,
          currency: true,
          billingPeriodMonths: true,
        },
      },
      user: {
        select: { id: true, email: true, firstName: true, lastName: true },
      },
    },
  })

  if (!member) return errorState('That membership no longer exists.')

  if (member.status === MemberStatus.ACTIVE) {
    return errorState('That membership is already active.')
  }

  const now = new Date()

  // Renewals extend from the existing expiry when it is still in the future,
  // so a member who pays early is not penalised by losing the remainder.
  const from =
    member.expiresAt && member.expiresAt > now ? member.expiresAt : now

  const expiresAt = addMonths(from, member.tier.billingPeriodMonths)

  const reference = paymentReference()
  const dueAt = new Date(now)
  dueAt.setDate(dueAt.getDate() + 14)

  let invoiceNo: string

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: member.id },
        data: {
          status: MemberStatus.ACTIVE,
          joinedAt: member.status === MemberStatus.PENDING ? now : undefined,
          expiresAt,
        },
      })

      const payment = await tx.payment.create({
        data: {
          reference,
          memberId: member.id,
          userId: member.user.id,
          purpose: PaymentPurpose.MEMBERSHIP,
          // Offline until finance records otherwise — the fee is invoiced,
          // not collected through the site.
          method: PaymentMethod.OFFLINE,
          currency: member.tier.currency,
          amountMinor: member.tier.priceMinor,
          status: PaymentStatus.PENDING,
          payerName: member.organisationName,
          payerEmail: member.user.email,
        },
        select: { id: true },
      })

      const invoice = await tx.invoice.create({
        data: {
          number: invoiceNumber((await tx.invoice.count()) + 1),
          paymentId: payment.id,
          dueAt,
          currency: member.tier.currency,
          subtotalMinor: member.tier.priceMinor,
          totalMinor: member.tier.priceMinor,
          status: InvoiceStatus.ISSUED,
          billToName: member.organisationName,
          billToEmail: member.user.email,
          notes: `${member.tier.name} membership ${member.memberNo}`,
        },
        select: { number: true },
      })

      return invoice.number
    })

    invoiceNo = result
  } catch {
    return errorState(
      'We could not activate that membership. Nothing has been changed — please try again.',
    )
  }

  const fee = isCurrency(member.tier.currency)
    ? formatMoney(member.tier.priceMinor, member.tier.currency)
    : String(member.tier.priceMinor)

  // ── Tell them, and let them in ────────────────────────────────────────────

  try {
    await sendMembershipActivated({
      to: member.user.email,
      firstName: member.user.firstName,
      memberNo: member.memberNo,
      tierName: member.tier.name,
      expiresAt,
      memberId: member.id,
    })
  } catch {
    // Activated; the welcome note is a convenience.
  }

  try {
    // Without this the account created by the public application form has a
    // random password nobody has ever seen.
    const token = await createPasswordResetToken(member.user.id)

    await sendPasswordReset({
      to: member.user.email,
      firstName: member.user.firstName,
      token,
    })
  } catch {
    // Recoverable from the portal's own "forgotten password" link.
  }

  try {
    await sendEmail({
      to: member.user.email,
      subject: `Invoice ${invoiceNo} — ${member.tier.name} membership`,
      template: 'membership.invoice',
      related: { type: 'Member', id: member.id },
      body: `Dear ${member.user.firstName},

Your ${member.tier.name} membership of the Freetown Business Forum is now
active. The invoice for the period is below.

  Invoice:    ${invoiceNo}
  Reference:  ${reference}
  Amount:     ${fee}
  Due:        ${dueAt.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}

Quote the reference on the transfer so we can match it to your membership.

—
Freetown Business Forum`,
    })
  } catch {
    // The invoice row exists and is visible in the portal.
  }

  await record({
    userId: staff.id,
    action: AuditAction.MEMBER_ACTIVATE,
    entityType: 'Member',
    entityId: member.id,
    summary: `Activated ${member.tier.name} membership ${member.memberNo} for ${member.organisationName}; invoice ${invoiceNo} for ${fee}.`,
    metadata: {
      memberNo: member.memberNo,
      tier: member.tier.name,
      invoice: invoiceNo,
      paymentReference: reference,
      expiresAt: expiresAt.toISOString(),
    },
  })

  revalidatePath('/admin/members')
  revalidatePath(`/admin/members/${member.memberNo}`)
  revalidatePath('/directory')

  return successState(
    `${member.organisationName} is now active. Invoice ${invoiceNo} has been raised for ${fee} and a welcome email sent.`,
  )
}

/**
 * Any other status change — suspend, expire, cancel, or back to pending.
 *
 * Kept apart from activation because activation has side effects (an invoice,
 * a password link) that must not fire when someone is merely being suspended.
 */
export async function setMemberStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.MEMBERSHIP_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const memberId = String(formData.get('memberId') ?? '')
  const parsed = memberStatusSchema.safeParse(formData.get('status'))

  if (!memberId || !parsed.success) {
    return errorState('That is not a status a membership can be put into.')
  }

  const status = parsed.data

  if (status === MemberStatus.ACTIVE) {
    return errorState(
      'Use "Activate membership" to make a membership active — it raises the invoice and issues the welcome email.',
    )
  }

  const member = await db.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      memberNo: true,
      status: true,
      organisationName: true,
      listing: { select: { id: true, slug: true, isPublished: true } },
    },
  })

  if (!member) return errorState('That membership no longer exists.')

  await db.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: member.id },
      data: { status },
    })

    // A directory entry is a benefit of a live membership. Leaving it public
    // for a suspended member is the forum vouching for someone it has just
    // stopped vouching for.
    if (member.listing?.isPublished) {
      await tx.directoryListing.update({
        where: { id: member.listing.id },
        data: { isPublished: false },
      })
    }
  })

  await record({
    userId: staff.id,
    action: AuditAction.MEMBER_STATUS,
    entityType: 'Member',
    entityId: member.id,
    summary: `Changed membership ${member.memberNo} (${member.organisationName}) from ${member.status} to ${status}.`,
    metadata: { from: member.status, to: status, memberNo: member.memberNo },
  })

  revalidatePath('/admin/members')
  revalidatePath(`/admin/members/${member.memberNo}`)
  revalidatePath('/directory')
  if (member.listing?.slug) revalidatePath(`/directory/${member.listing.slug}`)

  return successState(
    `${member.organisationName} is now ${status.toLowerCase()}.${
      member.listing?.isPublished
        ? ' Their directory entry has been unpublished.'
        : ''
    }`,
  )
}
