'use server'

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { AccessRequestStatus, ApplicationStatus } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { notifySecretariat, sendEmail } from '@/lib/notifications'
import { applicationReference } from '@/lib/reference'
import {
  fundingApplicationSchema,
  investorAccessRequestSchema,
  parseForm,
} from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * The Deal Room's two entry points (SDR §4.12, FR-15).
 *
 * Both follow the same shape as the enquiry action: validate, write the row,
 * then notify. The row is the record and the emails are a convenience on top
 * of it — a funding application lost because a mail gateway was down is a lost
 * business, and this one is the whole point of the module.
 *
 * Neither action requires an account. A business looking for capital and an
 * investor asking to see a data room are both at the top of the funnel, and
 * putting a sign-up in front of them loses the ones worth having. The user is
 * attached to the row when there happens to be a session, so the portal can
 * show them their own submissions later.
 */

// ── Businesses seeking capital ──────────────────────────────────────────────

export async function submitFundingApplication(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(fundingApplicationSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  // The honeypot is not part of the schema — it is not data, it is a trap.
  if (formData.get('website')) {
    return successState('Thank you — your application has been received.')
  }

  const data = parsed.data
  const user = await getCurrentUser()
  const reference = applicationReference()

  let applicationId: string

  try {
    const application = await db.fundingApplication.create({
      data: {
        reference,
        opportunityId: data.opportunityId || null,
        userId: user?.id ?? null,
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        sectorId: data.sectorId || null,
        region: data.region || null,
        amountRequestedMinor: data.amountRequestedMinor,
        currency: data.currency,
        stage: data.stage,
        businessDescription: data.businessDescription,
        useOfFunds: data.useOfFunds,
        yearsTrading: data.yearsTrading ?? null,
        employees: data.employees ?? null,
        annualRevenueMinor: data.annualRevenueMinor ?? null,
        status: ApplicationStatus.SUBMITTED,
      },
    })
    applicationId = application.id
  } catch {
    return errorState(
      'We could not record your application just now. Please try again shortly, or email the secretariat directly.',
    )
  }

  const amount = formatMoney(data.amountRequestedMinor, data.currency, {
    compact: true,
  })

  // Both messages are best-effort: the application is already safe.
  try {
    await sendEmail({
      to: data.email,
      subject: `Funding application received — ${reference}`,
      template: 'dealroom.application.received',
      related: { type: 'FundingApplication', id: applicationId },
      body: `Hello ${data.contactName},

We have received your application to the Freetown Business Forum Deal Room on
behalf of ${data.businessName}.

  Reference:  ${reference}
  Seeking:    ${amount}

Quote that reference in any correspondence. The secretariat reviews
applications in the order they arrive and will contact you about next steps.
Being listed in the Deal Room is not guaranteed — applications are assessed
before any proposition is published to investors.

—
Freetown Business Forum`,
    })
  } catch {
    // Recorded and reference issued; a failed acknowledgement is not the
    // applicant's problem.
  }

  try {
    await notifySecretariat({
      subject: `New funding application — ${data.businessName} (${amount})`,
      template: 'dealroom.application.staff',
      related: { type: 'FundingApplication', id: applicationId },
      body: `A funding application has been submitted.

  Reference:  ${reference}
  Business:   ${data.businessName}
  Contact:    ${data.contactName} — ${data.email}, ${data.phone}
  Seeking:    ${amount}
  Stage:      ${data.stage}

Review it in the admin panel.`,
    })
  } catch {
    // Staff notification only.
  }

  return successState(
    `Thank you — your application has been received. Your reference is ${reference}, and a copy has been emailed to ${data.email}.`,
    { reference },
  )
}

// ── Investors asking to see a proposition ───────────────────────────────────

export async function requestInvestorAccess(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(investorAccessRequestSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  if (formData.get('website')) {
    return successState('Thank you — your request has been received.')
  }

  const data = parsed.data
  const user = await getCurrentUser()

  // The opportunity has to exist and be published. A request against a draft
  // would be unanswerable, and accepting an arbitrary id from a form would let
  // anyone probe for unpublished propositions.
  const opportunity = await db.opportunity.findFirst({
    where: { id: data.opportunityId, isPublished: true },
    select: { id: true, title: true },
  })

  if (!opportunity) {
    return errorState(
      'That opportunity is no longer open for access requests. Browse the Deal Room for current propositions.',
    )
  }

  let requestId: string

  try {
    const created = await db.investorAccessRequest.create({
      data: {
        opportunityId: opportunity.id,
        userId: user?.id ?? null,
        investorName: data.investorName,
        organisation: data.organisation || null,
        email: data.email,
        phone: data.phone || null,
        country: data.country || null,
        investmentFocus: data.investmentFocus || null,
        ticketSizeMinor: data.ticketSizeMinor ?? null,
        currency: data.currency,
        message: data.message || null,
        status: AccessRequestStatus.PENDING,
      },
    })
    requestId = created.id
  } catch {
    return errorState(
      'We could not record your request just now. Please try again shortly, or email the secretariat directly.',
    )
  }

  try {
    await sendEmail({
      to: data.email,
      subject: `Access request received — ${opportunity.title}`,
      template: 'dealroom.access.received',
      related: { type: 'InvestorAccessRequest', id: requestId },
      body: `Hello ${data.investorName},

We have received your request for access to:

  ${opportunity.title}

The secretariat passes each request to the business behind the proposition.
You will hear from us once they have responded — full documents are released
only with their agreement.

—
Freetown Business Forum`,
    })
  } catch {
    // Recorded; acknowledgement is a convenience.
  }

  try {
    await notifySecretariat({
      subject: `Investor access request — ${opportunity.title}`,
      template: 'dealroom.access.staff',
      related: { type: 'InvestorAccessRequest', id: requestId },
      body: `An investor has requested access to a proposition.

  Opportunity:  ${opportunity.title}
  Investor:     ${data.investorName}${
    data.organisation ? ` (${data.organisation})` : ''
  }
  Email:        ${data.email}
  Country:      ${data.country || 'not given'}
  Ticket size:  ${
    data.ticketSizeMinor
      ? formatMoney(data.ticketSizeMinor, data.currency, { compact: true })
      : 'not given'
  }

Approve or decline it in the admin panel.`,
    })
  } catch {
    // Staff notification only.
  }

  return successState(
    'Thank you — your request has reached the secretariat. You will hear back once the business behind the proposition has responded.',
  )
}
