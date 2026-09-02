import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Container, Section } from '@/components/ui/layout'
import { db } from '@/lib/db'

/**
 * Newsletter double opt-in (FR-12).
 *
 * The link in the confirmation email lands here. Confirming is a state change
 * reached by a GET, which is normally the wrong shape — but the alternative is
 * asking someone who has already clicked a link in their inbox to click a
 * second button, and the thing being changed is a flag they explicitly asked
 * for. The token is single-use and cleared on success, so a mail scanner that
 * pre-fetches the URL confirms it once and no more.
 *
 * An unrecognised token is not distinguished from an expired one, and neither
 * reveals whether an address is on the list.
 */

export const metadata: Metadata = {
  title: 'Confirm your subscription',
  robots: { index: false, follow: false },
}

export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  let confirmed = false

  if (token) {
    const subscriber = await db.newsletterSubscriber.findFirst({
      where: { confirmToken: token },
      select: { id: true, isConfirmed: true },
    })

    if (subscriber) {
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          isConfirmed: true,
          // Single use — see the note at the top of this file.
          confirmToken: null,
          unsubscribedAt: null,
        },
      })
      confirmed = true
    }
  }

  return (
    <Section tone="muted" size="wide">
      <Container size="narrow" className="px-0">
        <div className="mx-auto max-w-md text-center">
          <span
            aria-hidden="true"
            className={`inline-flex size-14 items-center justify-center rounded-full ${
              confirmed ? 'bg-forest-50' : 'bg-ink-100'
            }`}
          >
            <Icon
              name={confirmed ? 'check' : 'mail'}
              className={`size-7 ${
                confirmed ? 'text-forest-700' : 'text-ink-500'
              }`}
            />
          </span>

          <h1 className="mt-5 font-display text-3xl font-bold text-ink-950">
            {confirmed ? 'You are subscribed' : 'This link has expired'}
          </h1>

          <p className="mt-3 leading-relaxed text-ink-600">
            {confirmed
              ? 'Thank you — you will get the Freetown Business Forum briefing. Every email carries an unsubscribe link, and we do not pass your address to anyone.'
              : 'That confirmation link is no longer valid — it may already have been used. If you are not receiving the briefing, sign up again from the foot of any page.'}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/" size="md">
              Back to the site
            </ButtonLink>
            {confirmed && (
              <ButtonLink href="/blog" variant="outline" size="md">
                Read the latest
              </ButtonLink>
            )}
          </div>
        </div>
      </Container>
    </Section>
  )
}
