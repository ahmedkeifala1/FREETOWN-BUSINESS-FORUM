import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  CtaBand,
  Section,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { SESSION_TYPE_LABELS, type SessionType } from '@/lib/enums'
import {
  formatTimeRange,
  formatWeekday,
  initials,
  paragraphs,
  truncate,
} from '@/lib/format'

/**
 * Speaker detail (SDR §4.6: "bio, organisation, and their sessions (linked)").
 *
 * The sessions list is the point of the page. A visitor who has clicked
 * through from the grid is deciding whether to be in the room, so every
 * session links back into the agenda at its own anchor rather than to the top
 * of the programme.
 */

type Params = { slug: string }

async function getSpeaker(slug: string) {
  return db.speaker.findFirst({
    where: { slug, isPublished: true },
    include: {
      sector: { select: { slug: true, name: true } },
      sessions: {
        orderBy: { session: { startsAt: 'asc' } },
        include: {
          session: {
            include: {
              track: { select: { name: true } },
              event: { select: { name: true, isPublished: true } },
            },
          },
        },
      },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const speaker = await getSpeaker(slug)

  if (!speaker) return { title: 'Speaker not found' }

  return {
    title: speaker.fullName,
    description: speaker.bio
      ? truncate(speaker.bio, 200)
      : `${speaker.fullName}, ${speaker.title} at ${speaker.organisation}, speaking at the Freetown Business Forum.`,
    alternates: { canonical: `/events/speakers/${speaker.slug}` },
    openGraph: {
      type: 'profile',
      title: speaker.fullName,
      description: `${speaker.title}, ${speaker.organisation}`,
      images: speaker.photoUrl ? [speaker.photoUrl] : undefined,
    },
  }
}

export default async function SpeakerPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const speaker = await getSpeaker(slug)

  if (!speaker) notFound()

  const sessions = speaker.sessions
    .map((link) => ({ ...link.session, role: link.role }))
    .filter((session) => session.isPublished && session.event.isPublished)

  const links = [
    speaker.linkedinUrl && { label: 'LinkedIn', href: speaker.linkedinUrl },
    speaker.twitterUrl && { label: 'X / Twitter', href: speaker.twitterUrl },
    speaker.websiteUrl && { label: 'Website', href: speaker.websiteUrl },
  ].filter((link): link is { label: string; href: string } => Boolean(link))

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Events', href: '/events' },
          { label: 'Speakers', href: '/events/speakers' },
          { label: speaker.fullName, href: `/events/speakers/${speaker.slug}` },
        ]}
      />

      <section className="bg-ink-950 text-white">
        <Container size="wide" className="py-12 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              {speaker.photoUrl ? (
                // Remote CMS URL — see the note in ui/card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={speaker.photoUrl}
                  alt={speaker.fullName}
                  className="aspect-4/5 w-full max-w-sm bg-ink-800 object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex aspect-4/5 w-full max-w-sm items-center justify-center bg-forest-900 font-display text-6xl font-bold text-white/20"
                >
                  {initials(speaker.fullName)}
                </span>
              )}
            </div>

            <div className="lg:col-span-8">
              {speaker.sector && (
                <Link
                  href={`/events/speakers?sector=${speaker.sector.slug}`}
                  className="text-sm font-semibold uppercase tracking-widest text-gold-400 hover:underline"
                >
                  {speaker.sector.name}
                </Link>
              )}

              <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {speaker.fullName}
              </h1>

              <p className="mt-4 text-lg text-white/80">
                {speaker.title}
                <span className="mx-2 text-white/30">·</span>
                <span className="font-medium text-white">
                  {speaker.organisation}
                </span>
              </p>

              {speaker.country && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-white/60">
                  <Icon name="pin" className="size-4" />
                  {speaker.country}
                </p>
              )}

              {links.length > 0 && (
                <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                  {links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-400 hover:underline"
                      >
                        <Icon name="globe" className="size-4" />
                        {link.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Container>
      </section>

      <Section tone="white" size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <h2 className="text-2xl text-ink-950 sm:text-3xl">Biography</h2>

            {speaker.bio ? (
              <div className="mt-5 space-y-4 leading-relaxed text-ink-700">
                {paragraphs(speaker.bio).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="mt-5 leading-relaxed text-ink-600">
                A full biography for {speaker.fullName} is being prepared and
                will be published before the forum opens.
              </p>
            )}
          </div>

          <div className="lg:col-span-5">
            <h2 className="text-2xl text-ink-950 sm:text-3xl">
              {sessions.length > 0 ? 'At the forum' : 'Sessions'}
            </h2>

            {sessions.length === 0 ? (
              <p className="mt-5 leading-relaxed text-ink-600">
                {speaker.fullName}’s sessions have not been scheduled yet. They
                will appear here, and in the{' '}
                <Link
                  href="/events/agenda"
                  className="font-medium text-forest-700 hover:underline"
                >
                  programme
                </Link>
                , as soon as they are confirmed.
              </p>
            ) : (
              <ul className="mt-5 space-y-4">
                {sessions.map((session) => (
                  <li key={session.id}>
                    <Link
                      href={`/events/agenda?day=${session.dayNumber}#${session.slug}`}
                      className="group block rounded-xl border border-ink-200 p-5 transition hover:border-forest-300 hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                          {SESSION_TYPE_LABELS[
                            session.sessionType as SessionType
                          ] ?? 'Session'}
                        </span>
                        {session.track && (
                          <Badge tone="neutral">{session.track.name}</Badge>
                        )}
                      </div>

                      <h3 className="mt-2 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                        {session.title}
                      </h3>

                      <p className="mt-2 text-sm text-ink-600">
                        {formatWeekday(session.startsAt)} ·{' '}
                        {formatTimeRange(session.startsAt, session.endsAt)}
                        {session.room && ` · ${session.room}`}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <Link
              href="/events/speakers"
              className="mt-6 inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
            >
              <Icon name="arrowRight" className="size-4 rotate-180" />
              All speakers
            </Link>
          </div>
        </div>
      </Section>

      <CtaBand
        title="Be in the room"
        lead="Registration covers every session on the programme, including the roundtables."
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
