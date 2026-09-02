import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

import { PaymentMethod, type PaymentMethod as PaymentMethodType } from '@/lib/enums'
import type { Currency } from '@/lib/money'

/**
 * Payment gateway abstraction (FR-07, §7 "payments isolated as a module").
 *
 * Each method — Orange Money, Afrimoney, card, offline invoice — implements the
 * same small interface, so the registration and membership flows never contain
 * a branch on provider. Adding a PSP means adding a driver here.
 *
 * IMPORTANT: no card data ever passes through this application (NFR-06). The
 * card driver returns a redirect to the PSP's hosted page; we store only the
 * provider's reference.
 *
 * FBF's merchant accounts are not yet provisioned, so every driver ships with
 * a sandbox implementation that simulates the full authorise → webhook →
 * confirm cycle locally. Set PAYMENTS_MODE=live plus the per-provider
 * credentials in .env to switch to real endpoints; `assertLiveConfig` fails
 * loudly at start-up rather than silently falling back to sandbox in
 * production.
 */

export type InitiateInput = {
  paymentId: string
  reference: string
  amountMinor: number
  currency: Currency
  description: string
  payerName: string
  payerEmail: string
  payerPhone?: string | null
  /** Absolute URL the PSP should return the payer to. */
  returnUrl: string
  /** Absolute URL the PSP should POST the confirmation webhook to. */
  callbackUrl: string
}

export type InitiateResult =
  | {
      /** Payer must be sent to the provider's hosted page. */
      kind: 'REDIRECT'
      providerRef: string
      redirectUrl: string
    }
  | {
      /** Payer completes on their handset; we wait for the webhook. */
      kind: 'AWAIT_CONFIRMATION'
      providerRef: string
      instructions: string
    }
  | {
      /** Nothing to collect now — an invoice is issued instead. */
      kind: 'OFFLINE'
      providerRef: string
      instructions: string
    }
  | {
      kind: 'FAILED'
      reason: string
    }

export type WebhookEvent = {
  providerRef: string
  reference: string
  status: 'PAID' | 'FAILED' | 'CANCELLED'
  amountMinor: number
  currency: string
  failureReason?: string
}

export interface PaymentGateway {
  readonly method: PaymentMethodType
  readonly provider: string
  readonly displayName: string
  /** Shown under the radio button on §4.9 step 3. */
  readonly blurb: string
  /** Mobile-money drivers need a handset number; card and offline do not. */
  readonly requiresPhone: boolean

  initiate(input: InitiateInput): Promise<InitiateResult>

  /**
   * Verify a webhook's authenticity and parse it. Returning null means the
   * signature did not check out and the request must be rejected — never
   * trust an unverified callback to mark money as received.
   */
  parseWebhook(rawBody: string, signature: string | null): WebhookEvent | null
}

const isSandbox = () => (process.env.PAYMENTS_MODE ?? 'sandbox') !== 'live'

/** Shared HMAC-SHA256 webhook verification. */
function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  if (!signature || !secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(signature.replace(/^sha256=/, ''))
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Sandbox reference. Deterministic on the payment id so replaying a webhook in
 * development resolves to the same payment.
 */
function sandboxRef(prefix: string, paymentId: string): string {
  return `${prefix}_SBX_${paymentId.slice(-10).toUpperCase()}`
}

function parseSignedWebhook(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): WebhookEvent | null {
  if (!verifySignature(rawBody, signature, secret)) return null

  try {
    const body = JSON.parse(rawBody) as Record<string, unknown>
    const status = String(body.status ?? '').toUpperCase()

    if (!['PAID', 'FAILED', 'CANCELLED'].includes(status)) return null
    if (typeof body.reference !== 'string') return null

    return {
      providerRef: String(body.providerRef ?? body.transactionId ?? ''),
      reference: body.reference,
      status: status as WebhookEvent['status'],
      amountMinor: Number(body.amountMinor ?? 0),
      currency: String(body.currency ?? 'SLE'),
      failureReason:
        typeof body.failureReason === 'string' ? body.failureReason : undefined,
    }
  } catch {
    return null
  }
}

// ── Orange Money ────────────────────────────────────────────────────────────

class OrangeMoneyGateway implements PaymentGateway {
  readonly method = PaymentMethod.ORANGE_MONEY
  readonly provider = 'orange-money'
  readonly displayName = 'Orange Money'
  readonly blurb =
    'Pay from your Orange Money wallet. You will receive a prompt on your phone to approve the payment.'
  readonly requiresPhone = true

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    if (isSandbox()) {
      return {
        kind: 'AWAIT_CONFIRMATION',
        providerRef: sandboxRef('OM', input.paymentId),
        instructions:
          'A payment prompt has been sent to your Orange Money number. Approve it with your PIN to confirm.',
      }
    }

    const baseUrl = process.env.ORANGE_MONEY_BASE_URL
    const apiKey = process.env.ORANGE_MONEY_API_KEY
    const merchantId = process.env.ORANGE_MONEY_MERCHANT_ID

    if (!baseUrl || !apiKey || !merchantId) {
      return { kind: 'FAILED', reason: 'Orange Money is not configured.' }
    }

    try {
      const response = await fetch(`${baseUrl}/webpayment`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          merchant_key: merchantId,
          currency: input.currency,
          order_id: input.reference,
          amount: input.amountMinor / 100,
          return_url: input.returnUrl,
          notif_url: input.callbackUrl,
          reference: input.description,
          msisdn: input.payerPhone,
        }),
      })

      if (!response.ok) {
        return {
          kind: 'FAILED',
          reason: `Orange Money rejected the request (${response.status}).`,
        }
      }

      const data = (await response.json()) as {
        pay_token?: string
        payment_url?: string
      }

      if (!data.pay_token) {
        return { kind: 'FAILED', reason: 'Orange Money returned no token.' }
      }

      return data.payment_url
        ? {
            kind: 'REDIRECT',
            providerRef: data.pay_token,
            redirectUrl: data.payment_url,
          }
        : {
            kind: 'AWAIT_CONFIRMATION',
            providerRef: data.pay_token,
            instructions:
              'Approve the prompt on your Orange Money handset to confirm payment.',
          }
    } catch (error) {
      return {
        kind: 'FAILED',
        reason:
          error instanceof Error
            ? `Could not reach Orange Money: ${error.message}`
            : 'Could not reach Orange Money.',
      }
    }
  }

  parseWebhook(rawBody: string, signature: string | null) {
    return parseSignedWebhook(
      rawBody,
      signature,
      process.env.ORANGE_MONEY_WEBHOOK_SECRET,
    )
  }
}

// ── Afrimoney ───────────────────────────────────────────────────────────────

class AfrimoneyGateway implements PaymentGateway {
  readonly method = PaymentMethod.AFRIMONEY
  readonly provider = 'afrimoney'
  readonly displayName = 'Afrimoney'
  readonly blurb =
    'Pay from your Afrimoney wallet. You will receive a prompt on your phone to approve the payment.'
  readonly requiresPhone = true

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    if (isSandbox()) {
      return {
        kind: 'AWAIT_CONFIRMATION',
        providerRef: sandboxRef('AFM', input.paymentId),
        instructions:
          'A payment prompt has been sent to your Afrimoney number. Approve it with your PIN to confirm.',
      }
    }

    const baseUrl = process.env.AFRIMONEY_BASE_URL
    const apiKey = process.env.AFRIMONEY_API_KEY
    const merchantId = process.env.AFRIMONEY_MERCHANT_ID

    if (!baseUrl || !apiKey || !merchantId) {
      return { kind: 'FAILED', reason: 'Afrimoney is not configured.' }
    }

    try {
      const response = await fetch(`${baseUrl}/collections/request`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          merchantId,
          externalId: input.reference,
          amount: input.amountMinor / 100,
          currency: input.currency,
          payerMsisdn: input.payerPhone,
          payerMessage: input.description,
          callbackUrl: input.callbackUrl,
        }),
      })

      if (!response.ok) {
        return {
          kind: 'FAILED',
          reason: `Afrimoney rejected the request (${response.status}).`,
        }
      }

      const data = (await response.json()) as { transactionId?: string }

      if (!data.transactionId) {
        return { kind: 'FAILED', reason: 'Afrimoney returned no transaction.' }
      }

      return {
        kind: 'AWAIT_CONFIRMATION',
        providerRef: data.transactionId,
        instructions:
          'Approve the prompt on your Afrimoney handset to confirm payment.',
      }
    } catch (error) {
      return {
        kind: 'FAILED',
        reason:
          error instanceof Error
            ? `Could not reach Afrimoney: ${error.message}`
            : 'Could not reach Afrimoney.',
      }
    }
  }

  parseWebhook(rawBody: string, signature: string | null) {
    return parseSignedWebhook(
      rawBody,
      signature,
      process.env.AFRIMONEY_WEBHOOK_SECRET,
    )
  }
}

// ── Card (hosted page) ──────────────────────────────────────────────────────

class CardGateway implements PaymentGateway {
  readonly method = PaymentMethod.CARD
  readonly provider = 'card-psp'
  readonly displayName = 'Debit or credit card'
  readonly blurb =
    'Visa, Mastercard and international cards. You will be taken to our payment provider’s secure page — FBF never sees or stores your card details.'
  readonly requiresPhone = false

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    if (isSandbox()) {
      // The sandbox "hosted page" is a local route that mimics the PSP so the
      // whole flow is walkable without credentials.
      const ref = sandboxRef('CARD', input.paymentId)
      const url = new URL('/checkout/sandbox', input.returnUrl)
      url.searchParams.set('ref', input.reference)
      url.searchParams.set('provider', this.provider)
      return { kind: 'REDIRECT', providerRef: ref, redirectUrl: url.toString() }
    }

    const baseUrl = process.env.CARD_PSP_BASE_URL
    const secretKey = process.env.CARD_PSP_SECRET_KEY

    if (!baseUrl || !secretKey) {
      return { kind: 'FAILED', reason: 'Card payments are not configured.' }
    }

    try {
      const response = await fetch(`${baseUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${secretKey}`,
        },
        body: JSON.stringify({
          reference: input.reference,
          amount: input.amountMinor,
          currency: input.currency,
          description: input.description,
          customer: { name: input.payerName, email: input.payerEmail },
          success_url: input.returnUrl,
          cancel_url: input.returnUrl,
          webhook_url: input.callbackUrl,
        }),
      })

      if (!response.ok) {
        return {
          kind: 'FAILED',
          reason: `The card provider rejected the request (${response.status}).`,
        }
      }

      const data = (await response.json()) as { id?: string; url?: string }

      if (!data.id || !data.url) {
        return {
          kind: 'FAILED',
          reason: 'The card provider returned no checkout session.',
        }
      }

      return { kind: 'REDIRECT', providerRef: data.id, redirectUrl: data.url }
    } catch (error) {
      return {
        kind: 'FAILED',
        reason:
          error instanceof Error
            ? `Could not reach the card provider: ${error.message}`
            : 'Could not reach the card provider.',
      }
    }
  }

  parseWebhook(rawBody: string, signature: string | null) {
    return parseSignedWebhook(
      rawBody,
      signature,
      process.env.CARD_PSP_WEBHOOK_SECRET,
    )
  }
}

// ── Offline / invoice ───────────────────────────────────────────────────────

class OfflineGateway implements PaymentGateway {
  readonly method = PaymentMethod.OFFLINE
  readonly provider = 'offline'
  readonly displayName = 'Bank transfer or cash'
  readonly blurb =
    'We will issue an invoice with our bank details. Your place is held as pending until the secretariat confirms payment.'
  readonly requiresPhone = false

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    return {
      kind: 'OFFLINE',
      providerRef: input.reference,
      instructions:
        'An invoice has been issued. Quote your reference when paying, then email the remittance advice to finance@fbf.sl.',
    }
  }

  /** Offline payments are reconciled by hand in the admin panel, not by webhook. */
  parseWebhook(): WebhookEvent | null {
    return null
  }
}

// ── Registry ────────────────────────────────────────────────────────────────

const GATEWAYS: Record<PaymentMethodType, PaymentGateway> = {
  ORANGE_MONEY: new OrangeMoneyGateway(),
  AFRIMONEY: new AfrimoneyGateway(),
  CARD: new CardGateway(),
  OFFLINE: new OfflineGateway(),
}

export function getGateway(method: PaymentMethodType): PaymentGateway {
  const gateway = GATEWAYS[method]
  if (!gateway) throw new Error(`Unknown payment method: ${method}`)
  return gateway
}

export function getGatewayByProvider(
  provider: string,
): PaymentGateway | undefined {
  return Object.values(GATEWAYS).find((g) => g.provider === provider)
}

/** Ordered for the §4.9 step 3 radio list — local methods first. */
export function listGateways(): PaymentGateway[] {
  return [
    GATEWAYS.ORANGE_MONEY,
    GATEWAYS.AFRIMONEY,
    GATEWAYS.CARD,
    GATEWAYS.OFFLINE,
  ]
}

export function isSandboxMode(): boolean {
  return isSandbox()
}

/**
 * Called from instrumentation at boot. In live mode a missing credential is a
 * hard failure — a silent fall back to sandbox would mean taking registrations
 * that never collect money.
 */
export function assertLiveConfig(): void {
  if (isSandbox()) return

  const required = [
    'ORANGE_MONEY_BASE_URL',
    'ORANGE_MONEY_MERCHANT_ID',
    'ORANGE_MONEY_API_KEY',
    'ORANGE_MONEY_WEBHOOK_SECRET',
    'AFRIMONEY_BASE_URL',
    'AFRIMONEY_MERCHANT_ID',
    'AFRIMONEY_API_KEY',
    'AFRIMONEY_WEBHOOK_SECRET',
    'CARD_PSP_BASE_URL',
    'CARD_PSP_SECRET_KEY',
    'CARD_PSP_WEBHOOK_SECRET',
  ]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `PAYMENTS_MODE=live but these variables are unset: ${missing.join(', ')}`,
    )
  }
}
