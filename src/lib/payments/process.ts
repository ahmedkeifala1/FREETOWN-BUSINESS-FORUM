import 'server-only'

import { db } from '@/lib/db'
import {
  InvoiceStatus,
  LedgerEntryType,
  PAYMENT_METHOD_LABELS,
  PaymentPurpose,
  PaymentStatus,
  RegistrationStatus,
  type PaymentMethod,
} from '@/lib/enums'
import { formatDateRange } from '@/lib/format'
import { isCurrency, type Currency } from '@/lib/money'
import {
  sendPaymentReceipt,
  sendRegistrationConfirmation,
} from '@/lib/notifications'
import { buildQrPayload, generateTicketCode } from '@/lib/tickets'

/**
 * What happens when money actually arrives (FR-05, FR-08, FR-14).
 *
 * Every route into "this payment is settled" — a mobile-money webhook, a card
 * PSP webhook, the sandbox checkout, an offline payment reconciled by finance
 * in the admin panel — ends here. One function, so a registration confirmed by
 * bank transfer is indistinguishable from one confirmed by Orange Money: same
 * ledger entries, same e-tickets, same receipt.
 *
 * It is deliberately idempotent. Payment providers retry webhooks, and they
 * retry them after they have already succeeded. Marking a payment PAID twice
 * must not issue two sets of tickets, double the ledger, or send the delegate
 * a second receipt — so the first thing this does is check whether the work
 * has already been done, and the state change is the guard.
 */

export type SettleResult =
  | { ok: true; alreadySettled: boolean }
  | { ok: false; reason: string }

/**
 * Mark a payment as received and do everything that follows from it.
 *
 * `rawCallback` is the verbatim provider body, stored for reconciliation and
 * dispute handling (§14 "audit logging of financial actions"). It is written
 * even on a duplicate delivery, because the second body is evidence too.
 */
export async function settlePayment(input: {
  paymentId: string
  providerRef?: string | null
  rawCallback?: string | null
  /** Who confirmed it, for an offline payment reconciled by hand. */
  confirmedById?: string | null
}): Promise<SettleResult> {
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    include: {
      registration: {
        include: {
          event: true,
          ticketType: { select: { id: true, name: true } },
          delegates: true,
        },
      },
      invoice: true,
    },
  })

  if (!payment) return { ok: false, reason: 'Payment not found.' }

  if (payment.status === PaymentStatus.PAID) {
    // A retried webhook. Record the body and stop — the tickets, the ledger
    // and the receipt were all done the first time.
    if (input.rawCallback) {
      await db.payment.update({
        where: { id: payment.id },
        data: { rawCallbackJson: input.rawCallback },
      })
    }
    return { ok: true, alreadySettled: true }
  }

  if (
    payment.status === PaymentStatus.REFUNDED ||
    payment.status === PaymentStatus.CANCELLED
  ) {
    return {
      ok: false,
      reason: `Payment ${payment.reference} is ${payment.status.toLowerCase()} and cannot be settled.`,
    }
  }

  const paidAt = new Date()
  const currency: Currency = isCurrency(payment.currency)
    ? payment.currency
    : 'SLE'

  const registration = payment.registration

  // Ticket codes are generated outside the transaction: signing is CPU work
  // and a SQLite write transaction should not be held open across it.
  const newDelegates =
    registration && registration.delegates.length === 0
      ? Array.from({ length: registration.quantity }, () => {
          const code = generateTicketCode()
          return { ticketCode: code, qrPayload: buildQrPayload(code) }
        })
      : []

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt,
        providerRef: input.providerRef ?? payment.providerRef,
        rawCallbackJson: input.rawCallback ?? payment.rawCallbackJson,
        failureReason: null,
      },
    })

    /*
     * The double entry (FR-14). Money arrived into an asset account and the
     * forum earned revenue against it; the two lines are equal and opposite,
     * so a trial balance over this table always nets to zero. Nothing in the
     * application ever updates or deletes a ledger row — a correction is
     * another pair of entries.
     */
    const account = assetAccountFor(payment.method as PaymentMethod)
    const description = `${
      PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method
    } — ${payment.reference}`

    await tx.ledgerEntry.createMany({
      data: [
        {
          paymentId: payment.id,
          entryType: LedgerEntryType.DEBIT,
          account,
          currency: payment.currency,
          amountMinor: payment.amountMinor,
          description,
          createdById: input.confirmedById ?? null,
        },
        {
          paymentId: payment.id,
          entryType: LedgerEntryType.CREDIT,
          account: `REVENUE:${payment.purpose}`,
          currency: payment.currency,
          amountMinor: payment.amountMinor,
          description,
          createdById: input.confirmedById ?? null,
        },
      ],
    })

    if (payment.invoice) {
      await tx.invoice.update({
        where: { id: payment.invoice.id },
        data: { status: InvoiceStatus.PAID },
      })
    }

    if (registration) {
      await tx.registration.update({
        where: { id: registration.id },
        data: {
          status: RegistrationStatus.CONFIRMED,
          confirmedAt: paidAt,
        },
      })

      if (newDelegates.length > 0) {
        await tx.delegate.createMany({
          data: newDelegates.map((delegate) => ({
            registrationId: registration.id,
            // The lead delegate's details stand in for every seat until the
            // booker names the others in the portal. A ticket that cannot be
            // issued because a group booker has not filled in nine names is a
            // ticket the desk cannot scan.
            firstName: registration.firstName,
            lastName: registration.lastName,
            email: registration.email,
            phone: registration.phone,
            organisation: registration.organisation,
            jobTitle: registration.jobTitle,
            ticketCode: delegate.ticketCode,
            qrPayload: delegate.qrPayload,
          })),
        })
      }

      /*
       * The seat count moves on confirmation, not on booking — see the note in
       * lib/registration.ts. `increment` rather than a read-modify-write so two
       * webhooks landing at once cannot lose a sale.
       */
      await tx.ticketType.update({
        where: { id: registration.ticketTypeId },
        data: { sold: { increment: registration.quantity } },
      })

      if (registration.promoCodeId) {
        await tx.promoCode.update({
          where: { id: registration.promoCodeId },
          data: { timesRedeemed: { increment: 1 } },
        })
      }
    }

    if (payment.memberId) {
      const { MemberStatus } = await import('@/lib/enums')
      const now = new Date()
      const member = await tx.member.findUnique({
        where: { id: payment.memberId },
        include: { tier: { select: { billingPeriodMonths: true } } },
      })

      if (member) {
        // Renewals extend from the existing expiry when it is still in the
        // future, so a member who renews early is not penalised for it.
        const from =
          member.expiresAt && member.expiresAt > now ? member.expiresAt : now
        const expiresAt = new Date(from)
        expiresAt.setMonth(
          expiresAt.getMonth() + (member.tier.billingPeriodMonths || 12),
        )

        await tx.member.update({
          where: { id: member.id },
          data: {
            status: MemberStatus.ACTIVE,
            joinedAt: member.joinedAt ?? now,
            expiresAt,
          },
        })
      }
    }
  })

  // ── Notifications ─────────────────────────────────────────────────────────
  //
  // Outside the transaction and individually guarded. The money is recorded and
  // the tickets exist; a mail gateway that is down must not roll that back or
  // surface as a payment failure to the delegate.

  try {
    await sendPaymentReceipt({
      to: payment.payerEmail ?? registration?.email ?? '',
      firstName: registration?.firstName ?? payment.payerName ?? 'there',
      reference: payment.reference,
      description: descriptionFor(payment.purpose, registration?.event.name),
      amountMinor: payment.amountMinor,
      currency,
      method:
        PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ??
        payment.method,
      paidAt,
      paymentId: payment.id,
    })
  } catch {
    // Receipt is a convenience; the ledger is the record.
  }

  if (registration) {
    try {
      const codes =
        newDelegates.length > 0
          ? newDelegates.map((delegate) => delegate.ticketCode)
          : registration.delegates.map((delegate) => delegate.ticketCode)

      await sendRegistrationConfirmation({
        to: registration.email,
        firstName: registration.firstName,
        reference: registration.reference,
        eventName: registration.event.name,
        eventDates: formatDateRange(
          registration.event.startDate,
          registration.event.endDate,
        ),
        venue: `${registration.event.venueName}, ${registration.event.city}`,
        ticketCodes: codes,
        totalMinor: registration.totalMinor,
        currency,
        registrationId: registration.id,
        phone: registration.phone,
      })
    } catch {
      // The delegate can always see their tickets on the confirmation page.
    }
  }

  return { ok: true, alreadySettled: false }
}

/** Record a failed or cancelled attempt. The registration stays pending. */
export async function failPayment(input: {
  paymentId: string
  reason: string
  status?: 'FAILED' | 'CANCELLED'
  rawCallback?: string | null
}): Promise<void> {
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    select: { id: true, status: true },
  })

  // A late failure for a payment that has already settled is noise from the
  // provider, and acting on it would un-confirm a paid registration.
  if (!payment || payment.status === PaymentStatus.PAID) return

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: input.status ?? PaymentStatus.FAILED,
      failureReason: input.reason,
      rawCallbackJson: input.rawCallback ?? undefined,
    },
  })
}

/**
 * Which asset account the money landed in.
 *
 * Separated by method because that is how it is reconciled: the mobile-money
 * float, the PSP's settlement account and the bank are three different
 * statements arriving on three different days.
 */
function assetAccountFor(method: PaymentMethod): string {
  switch (method) {
    case 'ORANGE_MONEY':
      return 'ASSET:MOBILE_MONEY:ORANGE'
    case 'AFRIMONEY':
      return 'ASSET:MOBILE_MONEY:AFRIMONEY'
    case 'CARD':
      return 'ASSET:CARD_SETTLEMENT'
    case 'OFFLINE':
      return 'ASSET:BANK'
    default:
      return 'ASSET:UNALLOCATED'
  }
}

function descriptionFor(purpose: string, eventName?: string): string {
  if (purpose === PaymentPurpose.EVENT_REGISTRATION) {
    return eventName ? `Registration — ${eventName}` : 'Forum registration'
  }
  if (purpose === PaymentPurpose.MEMBERSHIP) return 'FBF membership subscription'
  if (purpose === PaymentPurpose.SPONSORSHIP) return 'FBF sponsorship'
  return 'Freetown Business Forum'
}
