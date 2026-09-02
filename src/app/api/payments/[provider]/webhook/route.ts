import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { getGatewayByProvider } from '@/lib/payments/gateways'
import { failPayment, settlePayment } from '@/lib/payments/process'

/**
 * Payment confirmation webhooks (§13 "webhooks for payment confirmation").
 *
 * One route for every provider — the path segment selects the driver, and the
 * driver verifies the signature. Nothing here trusts the body before that
 * check passes: an unverified callback claiming a payment succeeded is exactly
 * the request an attacker would forge to get a free ticket (§14).
 *
 * The body is read as raw text rather than parsed JSON, because the HMAC is
 * computed over the bytes as sent. Re-serialising parsed JSON changes key
 * order and whitespace and would fail every signature.
 *
 * Responses are deliberately terse and always 200 once the signature checks
 * out, including for a payment we cannot act on. Providers retry non-2xx
 * responses, and retrying will not fix a payment that is already refunded —
 * the detail goes in the log, not into a retry loop.
 */

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params

  const gateway = getGatewayByProvider(provider)
  if (!gateway) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }

  const rawBody = await request.text()

  // Providers disagree about the header name; check the ones in use rather
  // than requiring each driver to know about the transport.
  const signature =
    request.headers.get('x-signature') ??
    request.headers.get('x-webhook-signature') ??
    request.headers.get('x-hub-signature-256')

  const event = gateway.parseWebhook(rawBody, signature)

  if (!event) {
    // 400, not 401: this is a malformed or unsigned request, and saying which
    // would tell a prober whether they had guessed the header right.
    return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 })
  }

  const payment = await db.payment.findUnique({
    where: { reference: event.reference },
    select: { id: true, amountMinor: true, currency: true },
  })

  if (!payment) {
    console.warn(
      `[webhook:${provider}] no payment for reference ${event.reference}`,
    )
    return NextResponse.json({ received: true })
  }

  /*
   * The amount is checked against what we asked for. A provider reporting a
   * different figure is either a bug or a tampered request, and confirming a
   * registration against an underpayment is not recoverable once the delegate
   * has a valid QR code.
   */
  if (
    event.status === 'PAID' &&
    (event.amountMinor !== payment.amountMinor ||
      event.currency !== payment.currency)
  ) {
    await failPayment({
      paymentId: payment.id,
      reason: `Amount mismatch: expected ${payment.amountMinor} ${payment.currency}, provider reported ${event.amountMinor} ${event.currency}.`,
      rawCallback: rawBody,
    })

    console.error(
      `[webhook:${provider}] amount mismatch on ${event.reference}`,
    )
    return NextResponse.json({ received: true })
  }

  if (event.status === 'PAID') {
    const result = await settlePayment({
      paymentId: payment.id,
      providerRef: event.providerRef,
      rawCallback: rawBody,
    })

    if (!result.ok) {
      console.error(`[webhook:${provider}] ${result.reason}`)
    }

    return NextResponse.json({ received: true })
  }

  await failPayment({
    paymentId: payment.id,
    reason: event.failureReason ?? `Provider reported ${event.status}.`,
    status: event.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
    rawCallback: rawBody,
  })

  return NextResponse.json({ received: true })
}
