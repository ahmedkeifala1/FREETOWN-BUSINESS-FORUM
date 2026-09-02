'use server'

import { revalidatePath } from 'next/cache'

import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import { AccessRequestStatus, ApplicationStatus, SubmissionStatus } from '@/lib/enums'
import { sendEmail } from '@/lib/notifications'
import { assertPermission, Permission } from '@/lib/rbac'
import {
  accessRequestStatusSchema,
  applicationStatusSchema,
  submissionStatusSchema,
} from '@/lib/validation'
import {
  errorState,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Reviewing what the public forms bring in (FR-15, §4.12, §12).
 *
 * Three decisions, one shape: read the row, check the new status is one the
 * vocabulary allows, write it with who decided and when, audit it, and — where
 * a person is waiting on an answer — tell them.
 *
 * Applicants are only emailed on a terminal decision. A funding application
 * moving from SUBMITTED to UNDER_REVIEW is bookkeeping; emailing someone to say
 * their application is still being considered trains them to ignore the message
 * that says it is not.
 */

// ── Funding applications ────────────────────────────────────────────────────

export async function decideFundingApplication(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.DEALROOM_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const id = String(formData.get('applicationId') ?? '')
  const parsed = applicationStatusSchema.safeParse(formData.get('status'))
  const notes = String(formData.get('reviewNotes') ?? '').trim()

  if (!id || !parsed.success) {
    return errorState('That is not a decision an application can be given.')
  }

  const status = parsed.data

  const application = await db.fundingApplication.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      businessName: true,
      contactName: true,
      email: true,
      status: true,
    },
  })

  if (!application) return errorState('That application no longer exists.')

  await db.fundingApplication.update({
    where: { id: application.id },
    data: {
      status,
      reviewNotes: notes || null,
      reviewedById: staff.id,
      reviewedAt: new Date(),
    },
  })

  await record({
    userId: staff.id,
    action: AuditAction.APPLICATION_DECISION,
    entityType: 'FundingApplication',
    entityId: application.id,
    summary: `Moved funding application ${application.reference} (${application.businessName}) from ${application.status} to ${status}.`,
    metadata: { reference: application.reference, from: application.status, to: status, notes },
  })

  // Only a final answer is worth an email — see the note at the top.
  const terminal =
    status === ApplicationStatus.APPROVED ||
    status === ApplicationStatus.REJECTED

  if (terminal) {
    try {
      await sendEmail({
        to: application.email,
        subject: `Your Deal Room application — ${application.reference}`,
        template: 'dealroom.application.decision',
        related: { type: 'FundingApplication', id: application.id },
        body: `Dear ${application.contactName},

We have finished reviewing the application you submitted on behalf of
${application.businessName}.

  Reference: ${application.reference}
  Outcome:   ${status === ApplicationStatus.APPROVED ? 'Taken forward' : 'Not taken forward on this occasion'}

${
  status === ApplicationStatus.APPROVED
    ? `The secretariat will be in touch to agree the wording of your proposition
before anything is published to investors. Nothing goes live until you have
seen and approved exactly what they will read.`
    : `We are not able to take this one forward. That is a judgement about fit
with the investors currently in the room rather than about your business, and
you are welcome to apply again with a future round.`
}

—
Freetown Business Forum`,
      })
    } catch {
      // The decision is recorded; the notification is a courtesy.
    }
  }

  revalidatePath('/admin/deal-room')

  return successState(
    `${application.businessName} moved to ${status.replaceAll('_', ' ').toLowerCase()}.${
      terminal ? ' They have been emailed.' : ''
    }`,
  )
}

// ── Investor access requests ────────────────────────────────────────────────

export async function decideAccessRequest(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.DEALROOM_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const id = String(formData.get('requestId') ?? '')
  const parsed = accessRequestStatusSchema.safeParse(formData.get('status'))

  if (!id || !parsed.success) {
    return errorState('That is not a decision a request can be given.')
  }

  const status = parsed.data

  const request = await db.investorAccessRequest.findUnique({
    where: { id },
    select: {
      id: true,
      investorName: true,
      email: true,
      status: true,
      opportunity: { select: { title: true } },
    },
  })

  if (!request) return errorState('That request no longer exists.')

  await db.investorAccessRequest.update({
    where: { id: request.id },
    data: { status, decidedById: staff.id, decidedAt: new Date() },
  })

  await record({
    userId: staff.id,
    action: AuditAction.ACCESS_REQUEST_DECISION,
    entityType: 'InvestorAccessRequest',
    entityId: request.id,
    summary: `${status === AccessRequestStatus.APPROVED ? 'Approved' : 'Declined'} access for ${request.investorName} to "${request.opportunity.title}".`,
    metadata: { from: request.status, to: status },
  })

  try {
    await sendEmail({
      to: request.email,
      subject: `Your access request — ${request.opportunity.title}`,
      template: 'dealroom.access.decision',
      related: { type: 'InvestorAccessRequest', id: request.id },
      body: `Dear ${request.investorName},

${
  status === AccessRequestStatus.APPROVED
    ? `The business behind "${request.opportunity.title}" has agreed to share their
information pack with you. The secretariat will send it separately, along with
an introduction.`
    : `The business behind "${request.opportunity.title}" has decided not to release
their pack at this stage. Other propositions in the Deal Room remain open, and
we are happy to suggest ones that fit your stated focus.`
}

—
Freetown Business Forum`,
    })
  } catch {
    // Decision recorded; notification is a courtesy.
  }

  revalidatePath('/admin/deal-room')

  return successState(
    `Access for ${request.investorName} ${
      status === AccessRequestStatus.APPROVED ? 'approved' : 'declined'
    }. They have been emailed.`,
  )
}

// ── Enquiries ───────────────────────────────────────────────────────────────

export async function setSubmissionStatus(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.SUBMISSION_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const id = String(formData.get('submissionId') ?? '')
  const parsed = submissionStatusSchema.safeParse(formData.get('status'))

  if (!id || !parsed.success) {
    return errorState('That is not a status an enquiry can be put into.')
  }

  const status = parsed.data

  const submission = await db.formSubmission.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  })

  if (!submission) return errorState('That enquiry no longer exists.')

  await db.formSubmission.update({
    where: { id: submission.id },
    data: {
      status,
      // Only stamp a handler once someone has actually dealt with it —
      // marking an enquiry read is not the same as answering it.
      ...(status === SubmissionStatus.RESPONDED
        ? { handledById: staff.id, handledAt: new Date() }
        : {}),
    },
  })

  revalidatePath('/admin/enquiries')

  return successState(
    `Enquiry from ${submission.name} marked ${status.toLowerCase()}.`,
  )
}
