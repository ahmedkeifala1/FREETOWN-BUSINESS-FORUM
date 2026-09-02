import type { Metadata } from 'next'

import { LegalPage, type LegalClause } from '@/components/site/legal-page'

/**
 * Terms & conditions.
 *
 * These are the terms a delegate accepts at checkout and a member accepts on
 * application, so the clause order here is the order they are agreed to:
 * what registration means, then what cancelling costs, then conduct and
 * liability. See components/site/legal-page.tsx for the shared renderer.
 */

export const metadata: Metadata = {
  title: 'Terms & conditions',
  description:
    'The terms governing use of the FBF website, forum registration and membership.',
  alternates: { canonical: '/terms' },
  robots: { index: false, follow: true },
}

const CLAUSES: readonly LegalClause[] = [
  { key: 'registration', title: 'Registration and payment' },
  { key: 'cancellation', title: 'Cancellations and refunds' },
  { key: 'membership', title: 'Membership' },
  { key: 'conduct', title: 'Conduct at the forum' },
  { key: 'content', title: 'Photography, recording and content' },
  { key: 'liability', title: 'Liability' },
  { key: 'law', title: 'Governing law' },
]

export default function TermsPage() {
  return (
    <LegalPage
      slug="terms"
      clauses={CLAUSES}
      breadcrumbLabel="Terms & conditions"
    />
  )
}
