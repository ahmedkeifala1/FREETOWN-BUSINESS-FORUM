'use server'

import { redirect } from 'next/navigation'

import { db } from '@/lib/db'
import { isSandboxMode } from '@/lib/payments/gateways'
import { failPayment, settlePayment } from '@/lib/payments/process'

/**
 * Sandbox payment controls.
 *
 * In sandbox mode no provider ever calls the webhook back, so without these a
 * local registration can be started but never finished — and the half of the
 * system that matters most (tickets, ledger, receipts) could not be exercised
 * at all before FBF's merchant accounts exist.
 *
 * Every function refuses to run unless PAYMENTS_MODE is sandbox. That check is
 * here, in the action, rather than only on the page that renders the button:
 * a Server Action is a public endpoint, and a control that is merely not
 * displayed is not disabled. In live mode these are inert.
 */

function assertSandbox(): void {
  if (!isSandboxMode()) {
    throw new Error(
      'Sandbox payment controls are disabled when PAYMENTS_MODE=live.',
    )
  }
}

/** Approve a sandbox payment, exactly as a real webhook would. */
export async function sandboxApprove(formData: FormData): Promise<void> {
  assertSandbox()

  const reference = String(formData.get('reference') ?? '')
  const back = String(formData.get('back') ?? '/')

  const payment = await db.payment.findUnique({
    where: { reference },
    select: { id: true },
  })

  if (payment) {
    await settlePayment({
      paymentId: payment.id,
      rawCallback: JSON.stringify({
        sandbox: true,
        status: 'PAID',
        reference,
        approvedAt: new Date().toISOString(),
      }),
    })
  }

  redirect(back)
}

/** Decline a sandbox payment — the delegate's place stays held. */
export async function sandboxDecline(formData: FormData): Promise<void> {
  assertSandbox()

  const reference = String(formData.get('reference') ?? '')
  const back = String(formData.get('back') ?? '/')

  const payment = await db.payment.findUnique({
    where: { reference },
    select: { id: true },
  })

  if (payment) {
    await failPayment({
      paymentId: payment.id,
      reason: 'Declined on the sandbox checkout page.',
      status: 'CANCELLED',
      rawCallback: JSON.stringify({
        sandbox: true,
        status: 'CANCELLED',
        reference,
      }),
    })
  }

  redirect(back)
}
