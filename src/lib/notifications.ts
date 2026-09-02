import 'server-only'

import { db } from '@/lib/db'
import { MessageChannel, MessageStatus } from '@/lib/enums'
import { formatMoney, type Currency } from '@/lib/money'

/**
 * Outbound email and SMS (FR-08, §10 "Communications").
 *
 * Store first, send second. Every message is persisted to `message_outbox`
 * before any network call, so a receipt is never lost because the mail host
 * was briefly unreachable — the row stays QUEUED and can be retried, and the
 * secretariat can answer "did the confirmation go out?" from the admin panel.
 *
 * Sending never throws into the caller. A delegate who has just paid must not
 * see an error page because an SMS gateway timed out; the payment is recorded,
 * the message is queued, and the failure is visible to staff instead.
 *
 * Transports are chosen by MAIL_MODE / SMS_MODE:
 *   log   (default) — write to the server log and mark SENT. Development, and
 *                     the correct production setting until FBF's gateway
 *                     contracts are signed.
 *   http            — POST to a transactional provider's REST endpoint. Works
 *                     with any provider that accepts a JSON body and a bearer
 *                     key, which covers the local SMS aggregators as well as
 *                     Postmark/Resend-style email APIs.
 *
 * SMTP is deliberately not implemented here: it would pull in a mail library
 * for no gain over the HTTP transport, which is what the shortlisted providers
 * actually recommend. If a self-hosted relay becomes a requirement, it slots in
 * as a third `case` below.
 */

type Related = { type: string; id: string } | null

type QueueInput = {
  to: string
  body: string
  subject?: string
  template?: string
  related?: Related
}

export type QueuedMessage = {
  id: string
  status: string
}

// ── Queueing ────────────────────────────────────────────────────────────────

async function queue(
  channel: string,
  input: QueueInput,
): Promise<QueuedMessage> {
  const message = await db.messageOutbox.create({
    data: {
      channel,
      recipient: input.to.trim(),
      subject: input.subject ?? null,
      body: input.body,
      template: input.template ?? null,
      relatedType: input.related?.type ?? null,
      relatedId: input.related?.id ?? null,
      status: MessageStatus.QUEUED,
    },
  })

  await attemptDelivery(message.id)

  return { id: message.id, status: MessageStatus.QUEUED }
}

export async function sendEmail(input: QueueInput): Promise<QueuedMessage> {
  return queue(MessageChannel.EMAIL, input)
}

export async function sendSms(
  input: Omit<QueueInput, 'subject'>,
): Promise<QueuedMessage> {
  return queue(MessageChannel.SMS, input)
}

// ── Delivery ────────────────────────────────────────────────────────────────

/**
 * Attempt one delivery of a queued message. Safe to call repeatedly — a
 * message already marked SENT is skipped, so a retry sweep cannot double-send.
 */
export async function attemptDelivery(messageId: string): Promise<void> {
  const message = await db.messageOutbox.findUnique({ where: { id: messageId } })
  if (!message || message.status === MessageStatus.SENT) return

  try {
    const delivered =
      message.channel === MessageChannel.SMS
        ? await deliverSms(message.recipient, message.body)
        : await deliverEmail(
            message.recipient,
            message.subject ?? '(no subject)',
            message.body,
          )

    await db.messageOutbox.update({
      where: { id: message.id },
      data: delivered
        ? {
            status: MessageStatus.SENT,
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          }
        : {
            status: MessageStatus.QUEUED,
            attempts: { increment: 1 },
            lastError: 'Transport is not configured.',
          },
    })
  } catch (error) {
    // Swallowed on purpose — see the module note. The row carries the reason.
    await db.messageOutbox.update({
      where: { id: message.id },
      data: {
        status: MessageStatus.QUEUED,
        attempts: { increment: 1 },
        lastError:
          error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
      },
    })
  }
}

/** Retry sweep for stuck messages. Called from the admin panel and a cron. */
export async function retryQueued(limit = 50): Promise<number> {
  const stuck = await db.messageOutbox.findMany({
    where: { status: MessageStatus.QUEUED, attempts: { lt: 5 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  for (const message of stuck) await attemptDelivery(message.id)

  return stuck.length
}

async function deliverEmail(
  to: string,
  subject: string,
  body: string,
): Promise<boolean> {
  const mode = process.env.MAIL_MODE ?? 'log'

  if (mode === 'http') {
    const url = process.env.MAIL_API_URL
    const key = process.env.MAIL_API_KEY
    if (!url || !key) return false

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'no-reply@fbf.sl',
        to,
        subject,
        text: body,
      }),
    })

    if (!response.ok) {
      throw new Error(`Mail provider returned ${response.status}.`)
    }
    return true
  }

  // Anything other than the two known transports is a configuration
  // mistake, not a silent no-op: swallowing it here would drop every
  // receipt the forum sends while the outbox reported them as delivered.
  if (mode !== 'log') {
    throw new Error(`MAIL_MODE is "${mode}" — expected "log" or "http".`)
  }

  console.info(`[mail] to=${to} subject=${subject}\n${body}\n`)
  return true
}

async function deliverSms(to: string, body: string): Promise<boolean> {
  const mode = process.env.SMS_MODE ?? 'log'

  if (mode === 'http') {
    const url = process.env.SMS_GATEWAY_URL
    const key = process.env.SMS_GATEWAY_KEY
    if (!url || !key) return false

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        sender: process.env.SMS_SENDER_ID ?? 'FBF',
        to,
        message: body,
      }),
    })

    if (!response.ok) {
      throw new Error(`SMS gateway returned ${response.status}.`)
    }
    return true
  }

  if (mode !== 'log') {
    throw new Error(`SMS_MODE is "${mode}" — expected "log" or "http".`)
  }

  console.info(`[sms] to=${to}\n${body}\n`)
  return true
}

// ── Templates ───────────────────────────────────────────────────────────────

/**
 * Message bodies live here rather than inline at the call sites so the
 * secretariat's wording is changed in one place, and so every message ends the
 * same way.
 *
 * Plain text throughout: it renders on every handset, costs a fraction of the
 * bytes of an HTML email on a 3G connection (NFR-01), and never lands in a spam
 * folder for having a broken image.
 */

const SITE_URL = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fbf.sl'

function signOff(): string {
  return `\n—\nFreetown Business Forum\n${SITE_URL()}`
}

export async function sendRegistrationConfirmation(input: {
  to: string
  firstName: string
  reference: string
  eventName: string
  eventDates: string
  venue: string
  ticketCodes: string[]
  totalMinor: number
  currency: Currency
  registrationId: string
  phone?: string | null
}): Promise<void> {
  const ticketList = input.ticketCodes.map((code) => `  • ${code}`).join('\n')

  await sendEmail({
    to: input.to,
    subject: `Your FBF registration is confirmed — ${input.reference}`,
    template: 'registration.confirmed',
    related: { type: 'Registration', id: input.registrationId },
    body: `Dear ${input.firstName},

Your registration for ${input.eventName} is confirmed.

Reference:  ${input.reference}
Dates:      ${input.eventDates}
Venue:      ${input.venue}
Paid:       ${formatMoney(input.totalMinor, input.currency, { withCode: true })}

Your e-ticket${input.ticketCodes.length > 1 ? 's' : ''}:
${ticketList}

Show the QR code in your portal at the registration desk — you can find it any
time at ${SITE_URL()}/portal/tickets. There is no need to print anything.

We look forward to welcoming you.${signOff()}`,
  })

  if (input.phone) {
    await sendSms({
      to: input.phone,
      template: 'registration.confirmed',
      related: { type: 'Registration', id: input.registrationId },
      body: `FBF: registration ${input.reference} confirmed for ${input.eventName}. Your e-ticket is at ${SITE_URL()}/portal/tickets`,
    })
  }
}

export async function sendOfflineInstructions(input: {
  to: string
  firstName: string
  reference: string
  invoiceNumber: string
  totalMinor: number
  currency: Currency
  paymentId: string
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `Invoice ${input.invoiceNumber} — FBF registration ${input.reference}`,
    template: 'payment.offline',
    related: { type: 'Payment', id: input.paymentId },
    body: `Dear ${input.firstName},

Thank you for registering for the Freetown Business Forum. Your place is
held as pending until we receive payment.

Invoice:    ${input.invoiceNumber}
Reference:  ${input.reference}
Amount due: ${formatMoney(input.totalMinor, input.currency, { withCode: true })}

Please quote reference ${input.reference} when paying, then email the remittance
advice to finance@fbf.sl. We will confirm your place and issue your e-ticket as
soon as the payment clears.${signOff()}`,
  })
}

export async function sendPaymentReceipt(input: {
  to: string
  firstName: string
  reference: string
  description: string
  amountMinor: number
  currency: Currency
  method: string
  paidAt: Date
  paymentId: string
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: `Receipt ${input.reference} — Freetown Business Forum`,
    template: 'payment.receipt',
    related: { type: 'Payment', id: input.paymentId },
    body: `Dear ${input.firstName},

We have received your payment. This email is your receipt.

Reference: ${input.reference}
For:       ${input.description}
Amount:    ${formatMoney(input.amountMinor, input.currency, { withCode: true })}
Method:    ${input.method}
Date:      ${input.paidAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}${signOff()}`,
  })
}

export async function sendPasswordReset(input: {
  to: string
  firstName: string
  token: string
}): Promise<void> {
  const link = `${SITE_URL()}/portal/reset-password?token=${input.token}`

  await sendEmail({
    to: input.to,
    subject: 'Reset your FBF password',
    template: 'auth.password-reset',
    body: `Dear ${input.firstName},

Someone asked to reset the password for your FBF account. If it was you, open
the link below within the next hour:

${link}

If it was not you, you can ignore this email — your password has not changed and
no one can use this link without your inbox.${signOff()}`,
  })
}

export async function sendMembershipReceived(input: {
  to: string
  firstName: string
  organisationName: string
  tierName: string
  memberId: string
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: 'We have received your FBF membership application',
    template: 'membership.received',
    related: { type: 'Member', id: input.memberId },
    body: `Dear ${input.firstName},

Thank you for applying for ${input.tierName} membership of the Sierra Leone
Business Forum on behalf of ${input.organisationName}.

The secretariat reviews applications within five working days. We will email you
as soon as your membership is active, along with your member number and details
of how to publish your entry in the business directory.${signOff()}`,
  })
}

export async function sendMembershipActivated(input: {
  to: string
  firstName: string
  memberNo: string
  tierName: string
  expiresAt: Date | null
  memberId: string
}): Promise<void> {
  const expiry = input.expiresAt
    ? `\nYour membership runs until ${input.expiresAt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}.`
    : ''

  await sendEmail({
    to: input.to,
    subject: `Welcome to FBF — member ${input.memberNo}`,
    template: 'membership.activated',
    related: { type: 'Member', id: input.memberId },
    body: `Dear ${input.firstName},

Your ${input.tierName} membership is now active.

Member number: ${input.memberNo}${expiry}

Sign in at ${SITE_URL()}/portal to manage your profile, publish your directory
listing, and open the member-only sections of the Deal Room.${signOff()}`,
  })
}

export async function sendEnquiryAcknowledgement(input: {
  to: string
  name: string
  subject: string | null
  submissionId: string
}): Promise<void> {
  await sendEmail({
    to: input.to,
    subject: 'We have received your message — FBF',
    template: 'enquiry.acknowledged',
    related: { type: 'FormSubmission', id: input.submissionId },
    body: `Dear ${input.name},

Thank you for contacting the Freetown Business Forum. Your message${
      input.subject ? ` about "${input.subject}"` : ''
    } has
reached the secretariat and we aim to reply within two working days.${signOff()}`,
  })
}

/** Notify staff that something needs a human. Never sent to the public. */
export async function notifySecretariat(input: {
  subject: string
  body: string
  related?: Related
  template?: string
}): Promise<void> {
  const to = process.env.SECRETARIAT_EMAIL
  if (!to) return

  await sendEmail({
    to,
    subject: input.subject,
    body: input.body,
    template: input.template,
    related: input.related ?? null,
  })
}
