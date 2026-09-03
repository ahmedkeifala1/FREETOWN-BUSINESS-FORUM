import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  CtaBand,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { ContentStatus } from '@/lib/enums'
import { formatDate, isoDate, paragraphs, parseJsonColumn } from '@/lib/format'
import { getSectors } from '@/lib/settings'

/**
 * "Doing Business in Sierra Leone" (SDR §4.12).
 *
 * A reference document, so it is built like one: a fixed chapter order in
 * code, the copy in the CMS, and a contents rail that turns each chapter into
 * an addressable anchor. Someone sends a colleague the tax section, not the
 * page.
 *
 * The chapter order is the order a business actually meets these things —
 * register, then be taxed, then find land and staff — rather than the order
 * they appear in the regulations.
 */

export const metadata: Metadata = {
  title: 'Doing business in Sierra Leone',
  description:
    'A practical guide to registering, taxing, financing and staffing a business in Sierra Leone — and the incentives available.',
  alternates: { canonical: '/learning-hub/doing-business' },
}

const CHAPTERS = [
  {
    key: 'registration',
    icon: 'document',
    title: 'Registering a company',
  },
  { key: 'tax', icon: 'briefcase', title: 'Tax' },
  { key: 'incentives', icon: 'trending', title: 'Investment incentives' },
  { key: 'land', icon: 'pin', title: 'Land and property' },
  { key: 'labour', icon: 'users', title: 'Employing people' },
  { key: 'banking', icon: 'smartphone', title: 'Banking and payments' },
  { key: 'imports', icon: 'globe', title: 'Imports and exports' },
  { key: 'disputes', icon: 'shield', title: 'Contracts and disputes' },
] as const

export default async function DoingBusinessPage() {
  const [page, sectors] = await Promise.all([
    db.page.findFirst({
      where: { slug: 'doing-business', status: ContentStatus.PUBLISHED },
    }),
    getSectors(),
  ])

  if (!page) notFound()

  const blocks = parseJsonColumn<Record<string, string>>(page.bodyJson, {})
  const chapters = CHAPTERS.filter(({ key }) => blocks[key])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Learning Hub', href: '/learning-hub' },
          {
            label: 'Doing business',
            href: '/learning-hub/doing-business',
          },
        ]}
      />

      <PageHero
        eyebrow={blocks.eyebrow ?? 'Learning Hub'}
        title={blocks.heroTitle ?? 'Doing business in'}
        accent={blocks.heroAccent ?? 'Sierra Leone'}
        lead={
          blocks.intro ??
          'What it takes to register, run and grow a business here — the practical version, written for people who are actually going to do it.'
        }
      />

      <Section tone="white" size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ── Contents ───────────────────────────────────────────────── */}

          <nav aria-label="Contents" className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <p className="text-sm font-semibold uppercase tracking-wider text-forest-700">
                Contents
              </p>

              <ol className="mt-4 space-y-2.5 border-l border-ink-200 pl-4 text-sm">
                {chapters.map(({ key, title }, index) => (
                  <li key={key}>
                    <a
                      href={`#${key}`}
                      className="text-ink-700 hover:text-forest-700 hover:underline"
                    >
                      <span aria-hidden="true" className="text-ink-400">
                        {index + 1}.{' '}
                      </span>
                      {title}
                    </a>
                  </li>
                ))}
              </ol>

              <p className="mt-6 text-xs text-ink-500">
                Last reviewed{' '}
                <time dateTime={isoDate(page.updatedAt)}>
                  {formatDate(page.updatedAt)}
                </time>
                .
              </p>
            </div>
          </nav>

          {/* ── Chapters ───────────────────────────────────────────────── */}

          <div className="space-y-12 lg:col-span-8">
            {chapters.map(({ key, icon, title }, index) => (
              <section key={key} id={key} className="scroll-mt-24">
                <div className="flex items-center gap-3">
                  <Icon
                    name={icon}
                    className="size-6 shrink-0 text-forest-600"
                  />
                  <h2 className="text-xl text-ink-950 sm:text-2xl">
                    <span aria-hidden="true" className="text-ink-400">
                      {index + 1}.{' '}
                    </span>
                    {title}
                  </h2>
                </div>

                <div className="mt-4 space-y-4 leading-relaxed text-ink-700">
                  {paragraphs(blocks[key]).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}

            {/*
              A guide about regulation that does not say when it was checked is
              worse than none — it invites someone to rely on a rate that has
              changed. The date above is the page's own updatedAt, so it cannot
              be stale relative to the copy.
            */}
            <div className="flex gap-3 rounded-xl bg-ink-50 p-5">
              <Icon
                name="shield"
                className="mt-0.5 size-5 shrink-0 text-ink-500"
              />
              <p className="text-sm leading-relaxed text-ink-600">
                This guide is a summary written for orientation, not advice.
                Rates, thresholds and procedures change — confirm anything you
                are relying on with the relevant agency, or ask the secretariat
                to put you in touch with a member who has done it recently.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Sector guides ────────────────────────────────────────────────── */}

      {sectors.length > 0 && (
        <Section tone="muted" size="wide">
          <SectionHeading
            eyebrow={blocks.sectorsEyebrow ?? 'Go deeper'}
            title={blocks.sectorsTitle ?? 'Sector guides'}
            lead={
              blocks.sectorsLead ??
              'What applies to everyone is above. What is specific to your sector — the incentives, the numbers and who is already there — is in these.'
            }
          />

          <CardGrid columns={4} className="mt-10">
            {sectors.map((sector) => (
              <Link
                key={sector.id}
                href={`/learning-hub/sectors/${sector.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-4 transition hover:border-forest-300 hover:shadow-md"
              >
                <Icon
                  name={sector.iconKey}
                  className="size-7 shrink-0 text-forest-600"
                />
                <span className="font-display text-sm font-semibold text-ink-950 group-hover:text-forest-700">
                  {sector.name}
                </span>
              </Link>
            ))}
          </CardGrid>
        </Section>
      )}

      <Section tone="white">
        <Container size="narrow" className="px-0">
          <h2 className="text-xl text-ink-950">Still stuck on something?</h2>
          <p className="mt-3 leading-relaxed text-ink-700">
            Members get a quarterly business clinic with sector advisers, which
            is where most of the questions this guide raises actually get
            answered. Anyone can ask the secretariat.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/contact" variant="primary">
              Ask the secretariat
            </ButtonLink>
            <ButtonLink href="/membership" variant="outline">
              About membership
            </ButtonLink>
          </div>
        </Container>
      </Section>

      <CtaBand
        title={blocks.ctaTitle ?? 'Bring the question to the forum'}
        lead={
          blocks.ctaLead ??
          'The people who answer these questions — ministries, regulators, banks and the businesses that have been through it — are all in one room for three days.'
        }
      >
        <ButtonLink
          href="/register"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Register to attend
        </ButtonLink>
      </CtaBand>
    </>
  )
}
