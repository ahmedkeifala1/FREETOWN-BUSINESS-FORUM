'use server'

import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications'
import { contactSchema, parseForm } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * The enquiry form behind "Make an enquiry" and the Contact page (FR-14).
 *
 * The submission is written to `form_submissions` first and the notification
 * sent second, deliberately: the secretariat's mail gateway is not yet
 * provisioned, and an enquiry that is lost because an email failed to send is
 * a lost enquiry. The row is the record; the email is a convenience on top of
 * it, and a failure to deliver it is logged rather than shown to the sender.
 *
 * A submission that trips the honeypot is answered with success and then
 * dropped — an error would only teach the bot to leave the field alone.
 */
export async function submitEnquiry(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(contactSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const { formType, name, email, phone, subject, message, website } = parsed.data

  if (website) {
    return successState('Thank you — the secretariat will be in touch.')
  }

  let submissionId: string

  try {
    const submission = await db.formSubmission.create({
      data: {
        formType,
        name,
        email,
        phone: phone ?? null,
        subject: subject ?? null,
        message,
      },
    })
    submissionId = submission.id
  } catch {
    return errorState(
      'We could not send your message just now. Please try again shortly, or email the secretariat directly.',
    )
  }

  try {
    await sendEmail({
      to: email,
      subject: 'We have received your message — FBF',
      template: 'contact.acknowledgement',
      related: { type: 'FormSubmission', id: submissionId },
      body: `Hello ${name},

Thank you for contacting the Freetown Business Forum. Your message has reached
the secretariat and someone will reply within two working days.

For reference, this is what you sent:

${message}

—
Freetown Business Forum`,
    })
  } catch {
    // The enquiry is safely recorded; a failed acknowledgement is not the
    // sender's problem and must not turn a saved message into an error.
  }

  return successState(
    'Thank you — your message has reached the secretariat. Someone will reply within two working days.',
  )
}
