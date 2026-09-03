import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  CtaBand,
  EmptyState,
  PageHero,
  Section,
} from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { db } from '@/lib/db'
import { initials } from '@/lib/format'
import { getCurrentEvent, getPageCopy } from '@/lib/settings'

/**
 * Speakers (SDR §4.6).
 *
 * A headshot grid with a sector filter and a name search, both server-side and
 * both in the URL — the same reasoning as the agenda: shareable, bookmarkable,
 * and working before hydration on a 3G handset (NFR-01).
 *
 * Search is matched in JavaScript over the fetched rows rather than in SQL,
 * because SQLite through Prisma cannot do a case-insensitive `contains` and a
 * SQL filter would miss "kamara" for someone who typed it in lower case. The
 * speaker list is tens of rows, not thousands; see the same note in
 * app/search/page.tsx.
 */

export const metadata: Metadata = {
  title: 'Speakers',
  description:
    'The ministers, investors, founders and development partners speaking at the Freetown Business Forum.',
  alternates: { canonical: '/events/speakers' },
}

export default async function SpeakersPage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string; q?: string }>
}) {
  const [{ sector, q }, event, copy] = await Promise.all([
    searchParams,
    getCurrentEvent(),
    getPageCopy('speakers'),
  ])

  const query = (q ?? '').trim()

  const [speakers, sectors] = await Promise.all([
    db.speaker.findMany({
      where: { isPublished: true },
      orderBy: [
        { isFeatured: 'desc' },
        { sortOrder: 'asc' },
        { fullName: 'asc' },
      ],
      include: {
        sector: { select: { slug: true, name: true } },
        _count: { select: { sessions: true } },
      },
    }),
    db.sector.findMany({
      where: { isPublished: true, speakers: { some: { isPublished: true } } },
      orderBy: { sortOrder: 'asc' },
      select: { slug: true, name: true },
    }),
  ])

  const needle = query.toLowerCase()

  const visible = speakers.filter((speaker) => {
    if (sector && speaker.sector?.slug !== sector) return false
    if (!needle) return true
    return [speaker.fullName, speaker.title, speaker.organisation].some(
      (field) => field.toLowerCase().includes(needle),
    )
  })

  const filterHref = (nextSector?: string) => {
    const params = new URLSearchParams()
    if (nextSector) params.set('sector', nextSector)
    if (query) params.set('q', query)
    const search = params.toString()
    return search ? `/events/speakers?${search}` : '/events/speakers'
  }

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Events', href: '/events' },
          { label: 'Speakers', href: '/events/speakers' },
        ]}
      />

      <PageHero
        eyebrow={copy('eyebrow', 'Events')}
        title={copy('heroTitle', 'Who is')}
        accent={copy('heroAccent', 'speaking')}
        lead={
          event
            ? `${copy('heroLeadPrefix', 'The people on the platform at')} ${event.name}. ${copy('heroLeadSuffix', 'More are confirmed each month until the programme closes.')}`
            : copy(
                'heroLeadNoEvent',
                'The people who take the platform at the forum.',
              )
        }
      />

      {/* Filter bar — a GET form and a row of links, no script. */}
      <div className="border-b border-ink-200 bg-ink-50">
        <Container size="wide">
          <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <form
              action="/events/speakers"
              method="get"
              className="flex w-full max-w-md"
            >
              {/* Keeps the sector filter on when the search is submitted. */}
              {sector && <input type="hidden" name="sector" value={sector} />}

              <label htmlFor="speaker-q" className="sr-only">
                Search speakers by name or organisation
              </label>
              <input
                id="speaker-q"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="Name or organisation"
                className="min-h-11 w-full rounded-l-lg border border-ink-300 bg-white px-3.5 py-2 text-sm text-ink-950 placeholder:text-ink-400 focus:border-forest-600"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-r-lg bg-forest-600 px-4 text-sm font-medium text-white hover:bg-forest-700"
              >
                <Icon name="search" className="size-4" />
                Search
              </button>
            </form>

            {sectors.length > 0 && (
              <nav aria-label="Filter speakers by sector">
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <SectorPill href={filterHref()} active={!sector}>
                      All sectors
                    </SectorPill>
                  </li>
                  {sectors.map((s) => (
                    <li key={s.slug}>
                      <SectorPill
                        href={filterHref(s.slug)}
                        active={sector === s.slug}
                      >
                        {s.name}
                      </SectorPill>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </Container>
      </div>

      <Section tone="white" size="wide">
        <p role="status" className="text-sm font-medium text-ink-600">
          {visible.length} speaker{visible.length === 1 ? '' : 's'}
          {sector && ' in this sector'}
          {query && ` matching “${query}”`}
        </p>

        {visible.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title={copy('emptyTitle', 'No speakers match that')}
              message={copy(
                'emptyMessage',
                'Try a surname, an organisation, or clear the filters to see everyone confirmed so far.',
              )}
            >
              <Link
                href="/events/speakers"
                className="font-medium text-forest-700 hover:underline"
              >
                Clear filters
              </Link>
            </EmptyState>
          </div>
        ) : (
          <CardGrid columns={4} className="mt-8">
            {visible.map((speaker) => (
              <Link
                key={speaker.id}
                href={`/events/speakers/${speaker.slug}`}
                className="group flex flex-col"
              >
                <SpeakerPortrait
                  photoUrl={speaker.photoUrl}
                  fullName={speaker.fullName}
                />

                <h2 className="mt-4 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                  {speaker.fullName}
                </h2>
                <p className="mt-1 text-sm leading-snug text-ink-600">
                  {speaker.title}
                </p>
                <p className="mt-0.5 text-sm font-medium leading-snug text-ink-700">
                  {speaker.organisation}
                </p>

                {speaker._count.sessions > 0 && (
                  <p className="mt-2 text-xs text-ink-500">
                    {speaker._count.sessions} session
                    {speaker._count.sessions === 1 ? '' : 's'}
                  </p>
                )}
              </Link>
            ))}
          </CardGrid>
        )}
      </Section>

      <CtaBand
        title={copy('ctaTitle', 'Want to speak at the forum?')}
        lead={copy(
          'ctaLead',
          'The secretariat takes proposals for panels and roundtables until the programme closes.',
        )}
        tone="harbour"
      >
        <ButtonLink href="/contact" variant="accent" size="lg">
          {copy('ctaProposeLabel', 'Propose a session')}
        </ButtonLink>
        <ButtonLink
          href="/events/agenda"
          size="lg"
          className="border border-white/30 bg-white/10 text-white hover:bg-white/20 active:bg-white/25"
        >
          See the programme
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function SectorPill({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex min-h-9 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'bg-forest-600 text-white'
          : 'bg-white text-ink-700 ring-1 ring-inset ring-ink-300 hover:ring-forest-400',
      )}
    >
      {children}
    </Link>
  )
}

/**
 * A speaker's headshot, or a tile standing in for one.
 *
 * Fixed 4:5 portrait so the grid stays even whatever the secretariat uploads —
 * a row of mixed aspect ratios is what makes a speaker grid look unfinished.
 * The fallback carries initials at portrait size rather than a small circle,
 * so a photographed and an unphotographed speaker occupy the same space.
 */
function SpeakerPortrait({
  photoUrl,
  fullName,
}: {
  photoUrl: string | null
  fullName: string
}) {
  if (photoUrl) {
    return (
      // Remote CMS URL — see the note in ui/card.tsx.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={fullName}
        loading="lazy"
        decoding="async"
        className="aspect-4/5 w-full bg-ink-100 object-cover transition group-hover:brightness-105"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex aspect-4/5 w-full items-center justify-center bg-forest-800 font-display text-4xl font-bold text-white/25"
    >
      {initials(fullName)}
    </span>
  )
}
