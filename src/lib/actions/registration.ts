'use server'

import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  RegistrationStatus,
} from '@/lib/enums'
import { isCurrency } from '@/lib/money'
import { sendOfflineInstructions } from '@/lib/notifications'
import { getGateway } from '@/lib/payments/gateways'
import {
  invoiceNumber,
  paymentReference,
  registrationReference,
} from '@/lib/reference'
import { quoteFor } from '@/lib/registration'
import {
  parseForm,
  paymentSelectionSchema,
  registrationDetailsSchema,
  ticketSelectionSchema,
} from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Event registration (SDR §4.9, FR-05 – FR-08).
 *
 * Two actions, one per step that writes: step 2 creates the Registration, step
 * 3 creates the Payment and hands off to a gateway. Step 1 is a GET form — the
 * selection belongs in the URL so a delegate can send "two member tickets"
 * to a colleague, and so the back button behaves.
 *
 * The price is recomputed from the ticket type and promo code ids at both
 * steps. Nothing numeric that came back through a form is ever trusted (see
 * lib/pricing.ts and lib/registration.ts).
 */

// ── Step 2 → create the registration ────────────────────────────────────────

export async function createRegistration(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const selection = parseForm(ticketSelectionSchema, formData)
  if (!selection.ok) {
    return errorState(
      'Your ticket selection was not carried over. Please start again from step one.',
    )
  }

  const details = parseForm(registrationDetailsSchema, formData)
  if (!details.ok) return fieldErrors(details.errors)

  if (formData.get('website')) {
    // Honeypot. Answered with a redirect-free success so the bot learns
    // nothing, and nothing is written.
    return successState('Thank you.')
  }

  const loaded = await quoteFor({
    eventId: selection.data.eventId,
    ticketTypeId: selection.data.ticketTypeId,
    quantity: selection.data.quantity,
    currency: selection.data.currency,
    promoCode: selection.data.promoCode ?? null,
  })

  if (!loaded.ok) {
    return errorState('That ticket type is no longer available.')
  }

  if (!loaded.result.ok) {
    return errorState(loaded.result.message)
  }

  const quote = loaded.result.quote
  const user = await getCurrentUser()
  const reference = registrationReference()

  // A promo code the delegate typed but which did not validate must not be
  // attached to the row: the discount was not applied, so recording a
  // redemption against it would corrupt the code's usage count.
  const promoApplied = quote.discounts.some((line) => line.kind === 'PROMO')

  let registrationId: string

  try {
    const registration = await db.registration.create({
      data: {
        reference,
        eventId: selection.data.eventId,
        ticketTypeId: selection.data.ticketTypeId,
        userId: user?.id ?? null,
        quantity: quote.quantity,

        firstName: details.data.firstName,
        lastName: details.data.lastName,
        email: details.data.email,
        phone: details.data.phone,
        organisation: details.data.organisation,
        jobTitle: details.data.jobTitle,
        country: details.data.country,
        dietary: details.data.dietary,
        accessibility: details.data.accessibility,

        isGroup: quote.quantity > 1,
        groupName: details.data.groupName,

        status: RegistrationStatus.PENDING,

        currency: quote.currency,
        subtotalMinor: quote.subtotalMinor,
        discountMinor: quote.discountMinor,
        totalMinor: quote.totalMinor,
        promoCodeId: promoApplied ? (loaded.promo?.id ?? null) : null,
      },
    })
    registrationId = registration.id
  } catch {
    return errorState(
      'We could not save your registration just now. Please try again in a moment — nothing has been charged.',
    )
  }

  // Outside the try: a redirect works by throwing, so catching around it would
  // swallow the navigation and report a failure that did not happen.
  redirect(`/register/${reference}/pay`)
}

// ── Step 3 → take the payment ───────────────────────────────────────────────

export async function startPayment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const reference = String(formData.get('reference') ?? '')
  if (!reference) return errorState('That registration could not be found.')

  const parsed = parseForm(paymentSelectionSchema, formData)
  if (!parsed.ok) return fieldErrors(parsed.errors)

  const registration = await db.registration.findUnique({
    where: { reference },
    include: {
      event: { select: { name: true } },
      payment: true,
      ticketType: { select: { name: true } },
    },
  })

  if (!registration) return errorState('That registration could not be found.')

  if (registration.status === RegistrationStatus.CANCELLED) {
    return errorState('That registration has been cancelled.')
  }

  if (registration.payment?.status === PaymentStatus.PAID) {
    redirect(`/register/${reference}`)
  }

  const method = parsed.data.method as (typeof PaymentMethod)[keyof typeof PaymentMethod]
  const gateway = getGateway(method)
  const currency = isCurrency(registration.currency)
    ? registration.currency
    : 'SLE'

  /*
   * One payment row per registration — the schema enforces it with a unique
   * key. A delegate who abandons Orange Money and comes back to pay by card is
   * reusing the same row rather than accumulating a trail of dead attempts, so
   * the method and provider reference are overwritten here.
   */
  const paymentRow = registration.payment
    ? await db.payment.update({
        where: { id: registration.payment.id },
        data: {
          method,
          provider: gateway.provider,
          status: PaymentStatus.PENDING,
          amountMinor: registration.totalMinor,
          currency: registration.currency,
          payerPhone: parsed.data.payerPhone ?? null,
          failureReason: null,
        },
      })
    : await db.payment.create({
        data: {
          reference: paymentReference(),
          registrationId: registration.id,
          userId: registration.userId,
          purpose: PaymentPurpose.EVENT_REGISTRATION,
          method,
          provider: gateway.provider,
          currency: registration.currency,
          amountMinor: registration.totalMinor,
          status: PaymentStatus.PENDING,
          payerName: `${registration.firstName} ${registration.lastName}`,
          payerEmail: registration.email,
          payerPhone: parsed.data.payerPhone ?? null,
        },
      })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const result = await gateway.initiate({
    paymentId: paymentRow.id,
    reference: paymentRow.reference,
    amountMinor: registration.totalMinor,
    currency,
    description: `${registration.event.name} — ${registration.ticketType.name} × ${registration.quantity}`,
    payerName: `${registration.firstName} ${registration.lastName}`,
    payerEmail: registration.email,
    payerPhone: parsed.data.payerPhone ?? registration.phone,
    returnUrl: `${siteUrl}/register/${reference}`,
    callbackUrl: `${siteUrl}/api/payments/${gateway.provider}/webhook`,
  })

  if (result.kind === 'FAILED') {
    await db.payment.update({
      where: { id: paymentRow.id },
      data: { status: PaymentStatus.FAILED, failureReason: result.reason },
    })

    return errorState(
      `${result.reason} Nothing has been charged — try another payment method, or contact the secretariat.`,
    )
  }

  await db.payment.update({
    where: { id: paymentRow.id },
    data: {
      providerRef: result.providerRef,
      // OFFLINE stays PENDING: nothing is in flight, an invoice is simply owed.
      status:
        result.kind === 'OFFLINE'
          ? PaymentStatus.PENDING
          : PaymentStatus.PROCESSING,
    },
  })

  if (result.kind === 'OFFLINE') {
    await issueInvoice({
      paymentId: paymentRow.id,
      reference: registration.reference,
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      organisation: registration.organisation,
      subtotalMinor: registration.subtotalMinor,
      totalMinor: registration.totalMinor,
      currency: registration.currency,
    })
  }

  if (result.kind === 'REDIRECT') {
    redirect(result.redirectUrl)
  }

  redirect(`/register/${reference}`)
}

/**
 * Issue the invoice behind an offline payment (FR-08).
 *
 * The number is sequential within the year for accounting continuity, taken
 * from the count of invoices already issued. Under real concurrency that is a
 * race; at the volume of offline registrations this forum takes — a handful a
 * week, entered over the phone — it is not worth a sequence table, and a
 * collision surfaces as a unique-constraint error rather than as two invoices
 * sharing a number.
 */
async function issueInvoice(input: {
  paymentId: string
  reference: string
  firstName: string
  lastName: string
  email: string
  organisation: string | null
  subtotalMinor: number
  totalMinor: number
  currency: string
}): Promise<void> {
  const existing = await db.invoice.findUnique({
    where: { paymentId: input.paymentId },
  })

  const dueAt = new Date()
  dueAt.setDate(dueAt.getDate() + 14)

  const invoice =
    existing ??
    (await db.invoice.create({
      data: {
        number: invoiceNumber((await db.invoice.count()) + 1),
        paymentId: input.paymentId,
        dueAt,
        currency: input.currency,
        subtotalMinor: input.subtotalMinor,
        totalMinor: input.totalMinor,
        status: InvoiceStatus.ISSUED,
        billToName:
          input.organisation ?? `${input.firstName} ${input.lastName}`,
        billToEmail: input.email,
        notes: `Registration ${input.reference}`,
      },
    }))

  try {
    await sendOfflineInstructions({
      to: input.email,
      firstName: input.firstName,
      reference: input.reference,
      invoiceNumber: invoice.number,
      totalMinor: input.totalMinor,
      currency: isCurrency(input.currency) ? input.currency : 'SLE',
      paymentId: input.paymentId,
    })
  } catch {
    // The invoice exists and is shown on the confirmation page; a failed
    // email must not fail the registration.
  }
}
