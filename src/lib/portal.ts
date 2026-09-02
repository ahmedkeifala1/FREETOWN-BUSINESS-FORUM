import 'server-only'

import { cache } from 'react'

import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/auth'

/**
 * The queries behind the member / delegate portal (§4.16).
 *
 * They live together because the dashboard and the sections it links to ask
 * the same questions, and because they share one rule that is easy to get
 * wrong in isolation: what belongs to a person is matched by user id *and* by
 * email address.
 *
 * Registration does not require an account (§4.9) — most delegates buy a
 * ticket months before they ever sign in, and those rows carry `userId: null`.
 * Matching on the session's email as well is what makes the portal show a
 * delegate the ticket they actually bought rather than an empty page. It is
 * safe because the email column on `users` is unique and is the thing the
 * password authenticates.
 *
 * Wrapped in React's `cache` so the layout, the dashboard and a section can
 * each ask without three round-trips.
 */

export const getMyRegistrations = cache(async (user: SessionUser) => {
  return db.registration.findMany({
    where: {
      OR: [{ userId: user.id }, { email: user.email }],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      reference: true,
      status: true,
      quantity: true,
      currency: true,
      totalMinor: true,
      createdAt: true,
      confirmedAt: true,
      isGroup: true,
      groupName: true,
      event: {
        select: {
          id: true,
          slug: true,
          name: true,
          theme: true,
          startDate: true,
          endDate: true,
          venueName: true,
          city: true,
        },
      },
      ticketType: { select: { name: true } },
      payment: {
        select: {
          reference: true,
          status: true,
          method: true,
          amountMinor: true,
          currency: true,
          paidAt: true,
          invoice: { select: { number: true, status: true } },
        },
      },
      delegates: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          organisation: true,
          jobTitle: true,
          ticketCode: true,
          qrPayload: true,
          checkedInAt: true,
        },
      },
    },
  })
})

export const getMyMembership = cache(async (user: SessionUser) => {
  if (!user.memberId) return null

  return db.member.findUnique({
    where: { id: user.memberId },
    select: {
      id: true,
      memberNo: true,
      status: true,
      organisationName: true,
      joinedAt: true,
      expiresAt: true,
      tier: {
        select: {
          id: true,
          slug: true,
          name: true,
          strapline: true,
          priceMinor: true,
          currency: true,
          featuresJson: true,
          billingPeriodMonths: true,
        },
      },
      listing: {
        select: {
          id: true,
          slug: true,
          businessName: true,
          shortDescription: true,
          fullDescription: true,
          sectorId: true,
          region: true,
          size: true,
          logoUrl: true,
          website: true,
          contactEmail: true,
          contactPhone: true,
          address: true,
          yearFounded: true,
          employees: true,
          isPublished: true,
          updatedAt: true,
        },
      },
    },
  })
})

/**
 * Receipts and invoices (§4.16 "invoices/receipts").
 *
 * Both the payments made as a person and those made against the membership,
 * because a delegate ticket and a membership renewal are the same question to
 * whoever is looking: what have I paid the forum, and what is outstanding?
 */
export const getMyPayments = cache(async (user: SessionUser) => {
  return db.payment.findMany({
    where: {
      OR: [
        { userId: user.id },
        { payerEmail: user.email },
        ...(user.memberId ? [{ memberId: user.memberId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      reference: true,
      purpose: true,
      method: true,
      status: true,
      currency: true,
      amountMinor: true,
      paidAt: true,
      createdAt: true,
      invoice: {
        select: { number: true, status: true, dueAt: true, totalMinor: true },
      },
      registration: { select: { reference: true, event: { select: { name: true } } } },
    },
  })
})

/** Deal Room submissions this person has made (§4.12). */
export const getMyFundingApplications = cache(async (user: SessionUser) => {
  return db.fundingApplication.findMany({
    where: { OR: [{ userId: user.id }, { email: user.email }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      reference: true,
      businessName: true,
      status: true,
      amountRequestedMinor: true,
      currency: true,
      createdAt: true,
    },
  })
})
