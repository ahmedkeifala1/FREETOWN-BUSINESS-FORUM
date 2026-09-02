import type { Metadata } from 'next'

import { LegalPage, type LegalClause } from '@/components/site/legal-page'

/**
 * Privacy policy (NFR-05 "privacy policy and consent").
 *
 * The route owns the clause order; the copy lives in the `privacy` CMS page.
 * See components/site/legal-page.tsx for why both legal documents share one
 * renderer.
 */

export const metadata: Metadata = {
  title: 'Privacy policy',
  description:
    'What personal data the Freetown Business Forum collects, why it collects it, and what you can ask us to do with it.',
  alternates: { canonical: '/privacy' },
  // A policy page has no business in search results ahead of the pages it
  // governs, but it must stay crawlable so the footer link is not a dead end.
  robots: { index: false, follow: true },
}

const CLAUSES: readonly LegalClause[] = [
  { key: 'collection', title: 'What we collect' },
  { key: 'use', title: 'How we use it' },
  { key: 'payments', title: 'Payments and card data' },
  { key: 'sharing', title: 'Who we share it with' },
  { key: 'retention', title: 'How long we keep it' },
  { key: 'cookies', title: 'Cookies' },
  { key: 'rights', title: 'Your rights' },
]

export default function PrivacyPage() {
  return (
    <LegalPage slug="privacy" clauses={CLAUSES} breadcrumbLabel="Privacy policy" />
  )
}
