'use server'

import { revalidatePath } from 'next/cache'

import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import { PaymentStatus } from '@/lib/enums'
import { formatMoney, isCurrency } from '@/lib/money'
import { failPayment, settlePayment } from '@/lib/payments/process'
import { assertPermission, Permission } from '@/lib/rbac'
import { verifyQrPayload } from '@/lib/tickets'
import { checkInSchema, parseForm } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Day-of-forum operations: check-in and reconciling money (FR-05, FR-07, §12).
 *
 * Neither action re-implements anything. Check-in verifies the HMAC through
 * lib/tickets and writes one column; reconciling an offline payment hands off
 * to `settlePayment`, which is the single road every settled payment takes
 * whether it came from a webhook or from a member of finance reading a bank
 * statement. Keeping that one road is what makes a bank-transfer registration
 * indistinguishable from a mobile-money one — same tickets, same ledger, same
 * receipt.
 */

// ── Check-in ────────────────────────────────────────────────────────────────

/**
 * Admit a delegate from a scanned QR code, or a ticket code typed by hand.
 *
 * The signature is checked before anything is looked up. A QR code is a string
 * a stranger can hand you, and the whole point of signing it is that a forged
 * one never reaches the database (FR-05).
 *
 * An already-admitted ticket is reported rather than refused: at a busy desk
 * the useful answer is "yes, that is them, they came through at 09:14", not an
 * error the steward has to interpret.
 */
export async function checkInDelegate(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.CHECKIN_PERFORM)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(checkInSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const raw = parsed.data.payload.trim()

  // A scan carries the signed payload; a typed entry is the bare code. Try the
  // signature first, and fall back to treating it as a code.
  const ticketCode = verifyQrPayload(raw) ?? raw.toUpperCase()

  const delegate = await db.delegate.findUnique({
    where: { ticketCode },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organisation: true,
      jobTitle: true,
      ticketCode: true,
      checkedInAt: true,
      registration: {
        select: {
          reference: true,
          status: true,
          ticketType: { select: { name: true } },
        },
      },
    },
  })

  if (!delegate) {
    return errorState(
      'That ticket is not recognised. Check the code, or search the registration by name.',
    )
  }

  const name = `${delegate.firstName} ${delegate.lastName}`

  if (delegate.registration.status !== 'CONFIRMED') {
    return errorState(
      `${name} — registration ${delegate.registration.reference} is ${delegate.registration.status.toLowerCase()}, not confirmed. Send them to the desk supervisor.`,
    )
  }

  if (delegate.checkedInAt) {
    return successState(
      `${name} was already admitted at ${delegate.checkedInAt.toLocaleTimeString(
        'en-GB',
        { hour: '2-digit', minute: '2-digit' },
      )}.`,
      {
        name,
        organisation: delegate.organisation ?? '',
        ticketType: delegate.registration.ticketType.name,
        repeat: 'true',
      },
    )
  }

  await db.delegate.update({
    where: { id: delegate.id },
    data: { checkedInAt: new Date(), checkedInBy: staff.id },
  })

  await record({
    userId: staff.id,
    action: AuditAction.REGISTRATION_CHECKIN,
    entityType: 'Delegate',
    entityId: delegate.id,
    summary: `Admitted ${name} (${delegate.ticketCode}) on registration ${delegate.registration.reference}.`,
    metadata: { ticketCode: delegate.ticketCode },
  })

  revalidatePath('/admin/check-in')

  return successState(`${name} admitted.`, {
    name,
    organisation: delegate.organisation ?? '',
    jobTitle: delegate.jobTitle ?? '',
    ticketType: delegate.registration.ticketType.name,
    repeat: 'false',
  })
}

// ── Reconciling money ───────────────────────────────────────────────────────

/**
 * Mark an invoiced payment as received, or as failed.
 *
 * Settling routes through `settlePayment`, so confirming a bank transfer
 * issues the e-tickets and writes the ledger exactly as a webhook would.
 */
export async function reconcilePayment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.PAYMENT_MANAGE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const paymentId = String(formData.get('paymentId') ?? '')
  const outcome = String(formData.get('outcome') ?? '')
  const note = String(formData.get('note') ?? '').trim()

  if (!paymentId) return errorState('No payment was named.')

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      reference: true,
      status: true,
      amountMinor: true,
      currency: true,
      registration: { select: { reference: true } },
    },
  })

  if (!payment) return errorState('That payment no longer exists.')

  const amount = isCurrency(payment.currency)
    ? formatMoney(payment.amountMinor, payment.currency)
    : String(payment.amountMinor)

  if (outcome === 'settle') {
    if (payment.status === PaymentStatus.PAID) {
      return errorState('That payment is already marked as received.')
    }

    const result = await settlePayment({
      paymentId: payment.id,
      providerRef: note || null,
      confirmedById: staff.id,
    })

    if (!result.ok) return errorState(result.reason)

    await record({
      userId: staff.id,
      action: AuditAction.PAYMENT_RECORD_OFFLINE,
      entityType: 'Payment',
      entityId: payment.id,
      summary: `Recorded ${amount} received against ${payment.reference}${
        payment.registration
          ? ` (registration ${payment.registration.reference})`
          : ''
      }.${note ? ` Note: ${note}` : ''}`,
      metadata: { reference: payment.reference, amountMinor: payment.amountMinor, note },
    })

    revalidatePath('/admin/payments')
    revalidatePath('/admin/registrations')

    return successState(
      result.alreadySettled
        ? 'That payment had already been settled — nothing was changed.'
        : `${amount} recorded against ${payment.reference}. Tickets and the receipt have gone out.`,
    )
  }

  if (outcome === 'fail') {
    if (payment.status === PaymentStatus.PAID) {
      return errorState(
        'That payment has already been received. Marking it failed would contradict the ledger — raise a refund instead.',
      )
    }

    await failPayment({
      paymentId: payment.id,
      reason: note || 'Marked as not received by staff.',
      status: 'FAILED',
    })

    await record({
      userId: staff.id,
      action: AuditAction.PAYMENT_RECORD_OFFLINE,
      entityType: 'Payment',
      entityId: payment.id,
      summary: `Marked ${payment.reference} (${amount}) as not received.${
        note ? ` Note: ${note}` : ''
      }`,
      metadata: { reference: payment.reference, note },
    })

    revalidatePath('/admin/payments')

    return successState(
      `${payment.reference} marked as not received. The registration stays pending.`,
    )
  }

  return errorState('Choose whether the payment was received or not.')
}
