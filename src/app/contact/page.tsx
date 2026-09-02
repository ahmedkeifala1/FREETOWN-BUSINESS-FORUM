import type { Metadata } from 'next'

import { ContactForm } from '@/components/site/contact-form'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { getSettings, setting } from '@/lib/settings'

/**
 * Contact Us (§4.14).
 *
 * The form and the direct details sit side by side rather than the form
 * alone. A visitor with a quick question wants the phone number, and one
 * carrying a proposition wants the form — making either group hunt for the
 * other's route costs enquiries.
 */

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Reach the Freetown Business Forum secretariat — by form, email, phone or WhatsApp.',
  alternates: { canonical: '/contact' },
}

export default async function ContactPage() {
  const settings = await getSettings()

  const email = setting(settings, 'contact.email')
  const phone = setting(settings, 'contact.phone')
  // Optional, so it is read straight off the row rather than through
  // `setting()` — an administrator who clears it should see the line go.
  const phoneAlt = settings['contact.phoneAlt']
  const address = setting(settings, 'contact.address')
  const whatsapp = settings['contact.whatsapp']
  const mapUrl = settings['contact.mapUrl']

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Contact Us', href: '/contact' },
        ]}
      />

      <PageHero
        eyebrow="Contact us"
        title="Talk to the"
        accent="secretariat"
        lead="Membership, sponsorship, the Deal Room, or a question about attending — this reaches a person, not a queue. We reply within two working days."
      />

      <Section tone="white" size="wide">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <SectionHeading
              eyebrow="Send a message"
              title="Make an enquiry"
              className="mb-8"
            />
            <ContactForm />
          </div>

          <div className="lg:col-span-5">
            <h2 className="font-display text-lg font-semibold text-ink-950">
              Or reach us directly
            </h2>

            <dl className="mt-6 space-y-6">
              <ContactRow icon="mail" label="Email">
                <a
                  href={`mailto:${email}`}
                  className="text-forest-700 underline underline-offset-2 hover:text-forest-800"
                >
                  {email}
                </a>
              </ContactRow>

              {/* One row, both numbers — the label pluralises so a reader is
                  not left wondering which of the two is the real one. */}
              <ContactRow icon="phone" label={phoneAlt ? 'Phone numbers' : 'Phone'}>
                <div className="flex flex-col gap-1">
                  <a
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className="text-forest-700 underline underline-offset-2 hover:text-forest-800"
                  >
                    {phone}
                  </a>
                  {phoneAlt && (
                    <a
                      href={`tel:${phoneAlt.replace(/\s/g, '')}`}
                      className="text-forest-700 underline underline-offset-2 hover:text-forest-800"
                    >
                      {phoneAlt}
                    </a>
                  )}
                </div>
              </ContactRow>

              {whatsapp && (
                <ContactRow icon="handshake" label="WhatsApp">
                  <a
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-forest-700 underline underline-offset-2 hover:text-forest-800"
                  >
                    Message us on WhatsApp
                  </a>
                </ContactRow>
              )}

              <ContactRow icon="pin" label="Secretariat">
                {mapUrl ? (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-forest-700 underline underline-offset-2 hover:text-forest-800"
                  >
                    {address}
                  </a>
                ) : (
                  address
                )}
              </ContactRow>

              <ContactRow icon="clock" label="Office hours">
                Monday to Friday, 09:00–17:00 GMT. Sierra Leone observes GMT all
                year, so there is no seasonal shift to allow for.
              </ContactRow>
            </dl>
          </div>
        </div>
      </Section>
    </>
  )
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4 border-t border-ink-200 pt-5">
      <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-gold-600" />
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </dt>
        <dd className="mt-1.5 leading-relaxed text-ink-800">{children}</dd>
      </div>
    </div>
  )
}
