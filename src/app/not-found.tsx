import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Section, SectionHeading } from '@/components/ui/layout'

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <Section tone="white" size="narrow">
      <SectionHeading
        as="h1"
        eyebrow="404"
        title="We could not find that page"
        lead="The link may be out of date, or the page may have moved. The sections below cover most of what people arrive looking for."
      />

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/" size="md">
          Back to the homepage
        </ButtonLink>
        <ButtonLink href="/forum/agenda" variant="outline" size="md">
          Forum agenda
        </ButtonLink>
        <ButtonLink href="/register" variant="outline" size="md">
          Register
        </ButtonLink>
        <ButtonLink href="/contact" variant="ghost" size="md">
          Contact the secretariat
        </ButtonLink>
      </div>
    </Section>
  )
}
