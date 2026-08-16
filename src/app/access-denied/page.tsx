import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Section, SectionHeading } from '@/components/ui/layout'
import { getCurrentUser } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/enums'

export const metadata: Metadata = {
  title: 'Access denied',
  robots: { index: false, follow: false },
}

/**
 * Where `requirePermission` sends a signed-in user who lacks the permission
 * (see src/lib/rbac.ts).
 *
 * Bouncing them to the login page instead would be the classic redirect loop:
 * they are already signed in, so logging in again changes nothing, and the
 * page would tell them nothing about why. This says what account they are
 * using and who to ask.
 */
export default async function AccessDeniedPage() {
  const user = await getCurrentUser()

  return (
    <Section tone="white" size="narrow">
      <SectionHeading
        as="h1"
        eyebrow="Access denied"
        title="You do not have permission to view that page"
        lead={
          user
            ? `You are signed in as ${user.email} with the ${ROLE_LABELS[user.role]} role, which does not include access to that section.`
            : 'You may need to sign in with an account that has the right permissions.'
        }
      />

      <p className="mt-6 text-ink-700">
        If you believe this is wrong, contact the secretariat and quote the page
        you were trying to reach — an administrator can adjust your role.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/" size="md">
          Back to the homepage
        </ButtonLink>
        {user ? (
          <ButtonLink href="/portal" variant="outline" size="md">
            My portal
          </ButtonLink>
        ) : (
          <ButtonLink href="/portal/login" variant="outline" size="md">
            Sign in
          </ButtonLink>
        )}
        <ButtonLink href="/contact" variant="ghost" size="md">
          Contact the secretariat
        </ButtonLink>
      </div>
    </Section>
  )
}
