import type { Metadata } from 'next'

import { FundingApplicationForm } from '@/components/site/funding-application-form'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { db } from '@/lib/db'

/**
 * Apply for funding (SDR §4.12 "businesses submit propositions", FR-15).
 *
 * A page with one job. There is no CTA band at the foot and no related
 * content: everything on it either helps someone fill the form in or gets out
 * of the way, because the only useful outcome of this page is a submitted
 * application.
 *
 * The "what happens next" rail sits beside the form on a wide screen and above
 * it on a phone — it answers the question that stops people starting, and it
 * has to be read before the first field, not after the last.
 */

export const metadata: Metadata = {
  title: 'Apply for funding',
  description:
    'Submit a proposition to the Freetown Business Forum Deal Room — what your business does, what it needs, and what the money is for.',
  alternates: { canonical: '/deal-room/apply' },
}

const STEPS = [
  {
    title: 'You submit',
    body: 'The form below. No account needed, and you get a reference number to quote.',
  },
  {
    title: 'The secretariat reviews',
    body: 'Someone reads it properly and comes back to you — usually within ten working days, either way.',
  },
  {
    title: 'You agree the wording',
    body: 'Nothing is published until you have seen and approved exactly what investors will read.',
  },
  {
    title: 'Investors ask',
    body: 'Requests come through the secretariat, naming who is asking. You decide what to release and to whom.',
  },
]

export default async function ApplyForFundingPage() {
  const sectors = await db.sector.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Deal Room', href: '/deal-room' },
          { label: 'Apply for funding', href: '/deal-room/apply' },
        ]}
      />

      <PageHero
        eyebrow="Deal Room"
        title="Apply for"
        accent="funding"
        lead="Tell us what the business does, what it needs and what the money is for. It takes about twenty minutes, and you can be as blunt as you like — this goes to the secretariat, not to investors."
      />

      <Section tone="white" size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ── What happens next ──────────────────────────────────────── */}

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-forest-700">
                What happens next
              </h2>

              <ol className="mt-6 space-y-6">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-50 font-display text-sm font-bold text-forest-700"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-display text-base font-semibold text-ink-950">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8 flex gap-3 rounded-xl bg-ink-50 p-4">
                <Icon
                  name="shield"
                  className="mt-0.5 size-5 shrink-0 text-ink-500"
                />
                <p className="text-sm leading-relaxed text-ink-600">
                  What you write here is read by the secretariat. It is not
                  published, and it is not passed to an investor without your
                  agreement.
                </p>
              </div>
            </div>
          </div>

          {/* ── The form ───────────────────────────────────────────────── */}

          <div className="lg:col-span-8">
            <FundingApplicationForm sectors={sectors} />
          </div>
        </div>
      </Section>

      <Section tone="muted">
        <Container size="narrow" className="px-0">
          <h2 className="text-xl text-ink-950">
            Not ready to submit a proposition?
          </h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Members get a business clinic with sector advisers before they
            apply, and a priority listing when they do. If the proposition needs
            work first, that is the place to start.
          </p>
          <a
            href="/membership"
            className="mt-4 inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
          >
            About membership
            <Icon name="arrowRight" className="size-4" />
          </a>
        </Container>
      </Section>
    </>
  )
}
