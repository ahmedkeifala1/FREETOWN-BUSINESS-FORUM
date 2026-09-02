import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { LoginForm } from '@/components/site/login-form'
import { Icon } from '@/components/ui/icon'
import { Container, Section } from '@/components/ui/layout'
import { getCurrentUser } from '@/lib/auth'
import { isStaff } from '@/lib/rbac'

/**
 * Sign in (§4.16).
 *
 * Deliberately not a full-width marketing page: a narrow column, one form, and
 * the two ways out of it — apply for membership, or register for the forum.
 * Both matter, because most people who arrive here without an account are not
 * lost, they simply do not have one yet, and a login page that only offers
 * "forgot password" turns them away.
 */

export const metadata: Metadata = {
  title: 'Sign in',
  description:
    'Sign in to the Freetown Business Forum portal for your tickets, membership and directory listing.',
  alternates: { canonical: '/portal/login' },
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const [{ next }, user] = await Promise.all([searchParams, getCurrentUser()])

  // Already signed in — there is nothing to do here.
  if (user) redirect(isStaff(user.role) ? '/admin' : '/portal')

  return (
    <Section tone="muted" size="wide">
      <Container size="narrow" className="px-0">
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Sign in
          </h1>
          <p className="mt-2 leading-relaxed text-ink-600">
            Your tickets, your membership and your directory listing.
          </p>

          <div className="mt-8 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">
            <LoginForm next={next} />
          </div>

          <div className="mt-8 space-y-3 text-sm text-ink-600">
            <p className="flex items-start gap-2">
              <Icon
                name="users"
                className="mt-0.5 size-4 shrink-0 text-ink-400"
              />
              <span>
                No account yet?{' '}
                <Link
                  href="/membership/apply"
                  className="font-medium text-forest-700 hover:underline"
                >
                  Apply for membership
                </Link>{' '}
                — accounts are created when your application is approved.
              </span>
            </p>

            <p className="flex items-start gap-2">
              <Icon
                name="ticket"
                className="mt-0.5 size-4 shrink-0 text-ink-400"
              />
              <span>
                Coming to the forum?{' '}
                <Link
                  href="/register"
                  className="font-medium text-forest-700 hover:underline"
                >
                  Register for a ticket
                </Link>{' '}
                — no account needed, and your e-ticket is emailed to you.
              </span>
            </p>
          </div>
        </div>
      </Container>
    </Section>
  )
}
