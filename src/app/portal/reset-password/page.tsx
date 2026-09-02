import type { Metadata } from 'next'

import { ResetPasswordForm } from '@/components/site/password-forms'
import { ButtonLink } from '@/components/ui/button'
import { Container, EmptyState, Section } from '@/components/ui/layout'

/**
 * Set a new password from an emailed link (FR-03).
 *
 * The token is only carried through to the form here — whether it is real,
 * unexpired and unused is decided by the action when the form is submitted.
 * Checking it on render would leak "this token is valid" to anyone who merely
 * opens the URL, and would consume single-use tokens by preview fetchers and
 * link scanners in corporate mail gateways.
 */

export const metadata: Metadata = {
  title: 'Set a new password',
  alternates: { canonical: '/portal/reset-password' },
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <Section tone="muted" size="wide">
      <Container size="narrow" className="px-0">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Set a new password
          </h1>

          {token ? (
            <>
              <p className="mt-2 leading-relaxed text-ink-600">
                Choose something you have not used elsewhere. Setting it signs
                you out on every other device.
              </p>

              <div className="mt-8 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
                <ResetPasswordForm token={token} />
              </div>
            </>
          ) : (
            <div className="mt-8">
              <EmptyState
                title="This link is incomplete"
                message="Open the link from the reset email exactly as it was sent — it carries a one-time code that is missing here. If the email is old, request a fresh one."
              >
                <ButtonLink href="/portal/forgot-password" size="md">
                  Request a new link
                </ButtonLink>
              </EmptyState>
            </div>
          )}
        </div>
      </Container>
    </Section>
  )
}
