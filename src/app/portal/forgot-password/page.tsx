import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/components/site/password-forms'
import { Container, Section } from '@/components/ui/layout'

export const metadata: Metadata = {
  title: 'Forgotten password',
  description: 'Request a link to reset your Freetown Business Forum password.',
  alternates: { canonical: '/portal/forgot-password' },
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    <Section tone="muted" size="wide">
      <Container size="narrow" className="px-0">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Forgotten your password?
          </h1>
          <p className="mt-2 leading-relaxed text-ink-600">
            Give us the email address on your account and we will send a link to
            set a new password. The link lasts an hour.
          </p>

          <div className="mt-8 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
            <ForgotPasswordForm />
          </div>
        </div>
      </Container>
    </Section>
  )
}
