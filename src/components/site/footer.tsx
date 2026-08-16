import Link from 'next/link'

import { Logo } from '@/components/site/logo'
import { FOOTER_NAV, LEGAL_NAV } from '@/components/site/nav'
import { NewsletterForm } from '@/components/site/newsletter-form'
import { Icon } from '@/components/ui/icon'
import { getSettings, setting } from '@/lib/settings'

/**
 * Global footer (§3.5).
 *
 * Contact details, the address, social links and the legal pages all come from
 * site settings so the secretariat can change a phone number without a
 * redeploy (§15). A Server Component: the only interactive part is the
 * newsletter form, which is its own island.
 */
export async function Footer() {
  const settings = await getSettings()

  const email = setting(settings, 'contact.email')
  const phone = setting(settings, 'contact.phone')
  const whatsapp = settings['contact.whatsapp']
  const address = setting(settings, 'contact.address')
  const mapUrl = settings['contact.mapUrl']

  const socials = [
    { label: 'LinkedIn', href: settings['social.linkedin'] },
    { label: 'X', href: settings['social.twitter'] },
    { label: 'Facebook', href: settings['social.facebook'] },
  ].filter((social): social is { label: string; href: string } => !!social.href)

  return (
    <footer className="mt-auto bg-ink-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Identity and contact */}
          <div className="lg:col-span-4">
            <Logo inverted />

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
              {setting(settings, 'site.tagline')}
            </p>

            <address className="mt-6 space-y-3 text-sm not-italic text-white/80">
              <p className="flex gap-2.5">
                <Icon name="pin" className="mt-0.5 size-4 shrink-0 text-gold-400" />
                {mapUrl ? (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-white hover:underline"
                  >
                    {address}
                  </a>
                ) : (
                  <span>{address}</span>
                )}
              </p>

              <p className="flex gap-2.5">
                <Icon name="mail" className="mt-0.5 size-4 shrink-0 text-gold-400" />
                <a href={`mailto:${email}`} className="hover:text-white hover:underline">
                  {email}
                </a>
              </p>

              <p className="flex gap-2.5">
                <Icon name="phone" className="mt-0.5 size-4 shrink-0 text-gold-400" />
                <a
                  href={`tel:${phone.replace(/\s/g, '')}`}
                  className="hover:text-white hover:underline"
                >
                  {phone}
                </a>
              </p>

              {whatsapp && (
                <p className="flex gap-2.5">
                  <Icon
                    name="handshake"
                    className="mt-0.5 size-4 shrink-0 text-gold-400"
                  />
                  <a
                    href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="hover:text-white hover:underline"
                  >
                    Message us on WhatsApp
                  </a>
                </p>
              )}
            </address>

            {socials.length > 0 && (
              <ul className="mt-6 flex gap-3">
                {socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex size-10 items-center justify-center bg-white/10 text-sm font-semibold text-white/80 transition hover:bg-white/20 hover:text-white"
                    >
                      <span className="sr-only">{social.label}</span>
                      <span aria-hidden="true">{social.label[0]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sitemap */}
          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-2">
            {FOOTER_NAV.map((group) => (
              <div key={group.heading}>
                <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-gold-400">
                  {group.heading}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-sm text-white/70 transition hover:text-white hover:underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter (FR-12) */}
          <div className="lg:col-span-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-gold-400">
              Stay informed
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/70">
              {setting(
                settings,
                'newsletter.blurb',
                'Monthly briefings on investment opportunities, policy changes and forum news.',
              )}
            </p>
            <NewsletterForm className="mt-4" source="footer" />
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} {setting(settings, 'site.name')}. All
            rights reserved.
          </p>

          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-xs text-white/50 transition hover:text-white hover:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
