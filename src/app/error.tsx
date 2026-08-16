'use client'

import { useEffect } from 'react'

import { Button, ButtonLink } from '@/components/ui/button'
import { Section, SectionHeading } from '@/components/ui/layout'

/**
 * Route-level error boundary (§6 NFR-03 "graceful degradation").
 *
 * The message never includes `error.message`: a database or gateway failure
 * can carry connection strings or provider detail, and this page is public.
 * The digest is shown instead — it is a safe identifier the secretariat can
 * quote to match a report against the server logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled route error:', error)
  }, [error])

  return (
    <Section tone="white" size="narrow">
      <SectionHeading
        as="h1"
        eyebrow="Something went wrong"
        title="We could not load that page"
        lead="This is our fault, not yours. Trying again often works — the secretariat has been notified if the problem persists."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={reset} size="md">
          Try again
        </Button>
        <ButtonLink href="/" variant="outline" size="md">
          Back to the homepage
        </ButtonLink>
        <ButtonLink href="/contact" variant="ghost" size="md">
          Report the problem
        </ButtonLink>
      </div>

      {error.digest && (
        <p className="mt-8 text-sm text-ink-500">
          Reference code: <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </Section>
  )
}
