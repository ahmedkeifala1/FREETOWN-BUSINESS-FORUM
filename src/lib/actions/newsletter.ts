'use server'

import { randomBytes } from 'node:crypto'

import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications'
import { newsletterSchema, parseForm } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Newsletter signup (FR-12), reachable from the footer and the homepage.
 *
 * Two deliberate choices about what this does *not* reveal:
 *
 *  - An address that is already subscribed gets the same success message as a
 *    new one. Telling a stranger "that address is already on our list" turns
 *    the form into a membership oracle.
 *  - A submission that trips the honeypot is answered with success and then
 *    dropped. An error would teach the bot to leave the field alone.
 */
export async function subscribeToNewsletter(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(newsletterSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const { email, name, source, website } = parsed.data

  if (website) return successState('Thank you — please check your inbox.')

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
    })

    if (existing) {
      // Re-subscribing after an unsubscribe must work.
      if (existing.unsubscribedAt) {
        await db.newsletterSubscriber.update({
          where: { email },
          data: { unsubscribedAt: null, name: name ?? existing.name },
        })
      }

      return successState('Thank you — please check your inbox.')
    }

    const confirmToken = randomBytes(24).toString('base64url')

    const subscriber = await db.newsletterSubscriber.create({
      data: {
        email,
        name: name ?? null,
        source: source ?? null,
        confirmToken,
      },
    })

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fbf.sl'

    await sendEmail({
      to: email,
      subject: 'Confirm your FBF newsletter subscription',
      template: 'newsletter.confirm',
      related: { type: 'NewsletterSubscriber', id: subscriber.id },
      body: `Hello${name ? ` ${name}` : ''},

Please confirm you would like to receive the Freetown Business Forum
briefing by opening this link:

${siteUrl}/newsletter/confirm?token=${confirmToken}

If you did not ask for this, you can ignore this email and we will not contact
you again.

—
Freetown Business Forum
${siteUrl}`,
    })

    return successState('Thank you — please check your inbox to confirm.')
  } catch {
    return errorState(
      'We could not save your subscription just now. Please try again shortly.',
    )
  }
}
