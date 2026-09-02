import { notFound } from 'next/navigation'

import {
  Breadcrumbs,
  Container,
  Section,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { ContentStatus } from '@/lib/enums'
import { formatDate, isoDate, paragraphs, parseJsonColumn } from '@/lib/format'

/**
 * The shared renderer behind /privacy and /terms (SDR §3.5 footer legal links,
 * NFR-05 "privacy policy and consent").
 *
 * Both pages are the same object: a title, a lead, a numbered list of clauses
 * and a last-reviewed date. One component rather than two routes' worth of
 * near-identical JSX means a change to how a clause is anchored or cited
 * happens once, and the two documents cannot drift into looking like they came
 * from different organisations.
 *
 * The clause order is fixed in code and the copy comes from the database, so
 * the secretariat can reword a clause without a redeploy but cannot silently
 * reorder a contract (FR-01, FR-02).
 *
 * `notFound()` rather than an empty shell when the page is unpublished: a
 * privacy policy that renders as a heading with nothing under it is worse than
 * a 404, because it looks like the forum has no policy rather than like the
 * link is broken.
 */

export type LegalClause = {
  /** Block key in the CMS page body. */
  key: string
  title: string
}

export async function LegalPage({
  slug,
  clauses,
  breadcrumbLabel,
}: {
  slug: string
  clauses: readonly LegalClause[]
  breadcrumbLabel: string
}) {
  const page = await db.page.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
  })

  if (!page) notFound()

  const blocks = parseJsonColumn<Record<string, string>>(page.bodyJson, {})
  const present = clauses.filter((clause) => blocks[clause.key])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: breadcrumbLabel, href: `/${slug}` },
        ]}
      />

      <Section tone="white" size="narrow" className="pb-0">
        <h1 className="text-3xl text-ink-950 sm:text-4xl lg:text-5xl">
          {page.title}
        </h1>

        {blocks.intro && (
          <p className="mt-6 text-lg leading-relaxed text-ink-700">
            {blocks.intro}
          </p>
        )}

        <p className="mt-6 text-sm text-ink-500">
          Last reviewed{' '}
          <time dateTime={isoDate(page.updatedAt)}>
            {formatDate(page.updatedAt)}
          </time>
          .
        </p>
      </Section>

      <Section tone="white" size="narrow">
        {/*
          Numbered so a clause can be cited in correspondence — "clause 4" has
          to mean the same thing in an email as it does on screen. The number
          is generated from position rather than typed into the copy, so it
          cannot fall out of step with the list.
        */}
        <ol className="border-t border-ink-200">
          {present.map((clause, index) => (
            <li
              key={clause.key}
              id={clause.key}
              className="scroll-mt-28 border-b border-ink-200 py-8"
            >
              <h2 className="flex gap-3 text-xl text-ink-950 sm:text-2xl">
                <span aria-hidden="true" className="text-ink-400">
                  {index + 1}.
                </span>
                {clause.title}
              </h2>

              <div className="mt-4 space-y-4 leading-relaxed text-ink-700">
                {paragraphs(blocks[clause.key]).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="muted" size="narrow">
        <Container className="px-0">
          <h2 className="text-xl text-ink-950">Questions about this policy</h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Write to the secretariat and someone will answer. If you want data
            we hold about you corrected or deleted, say so and the request will
            be actioned.
          </p>
          <a
            href="/contact"
            className="mt-4 inline-flex font-medium text-forest-700 hover:underline"
          >
            Contact the secretariat
          </a>
        </Container>
      </Section>
    </>
  )
}
