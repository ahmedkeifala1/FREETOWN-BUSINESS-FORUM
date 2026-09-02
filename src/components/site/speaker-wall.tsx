import Link from 'next/link'

import { Icon } from '@/components/ui/icon'
import { Section, SectionHeading } from '@/components/ui/layout'
import { initials, truncate } from '@/lib/format'

/**
 * A wall of faces (§4.2 "featured speakers").
 *
 * Photographs at tile size with the name over them, rather than avatars on
 * cards — the point of this band is the calibre of the room, and that reads
 * from the faces before it reads from the job titles.
 *
 * Shared by the homepage and the Learning Hub, which both open the same
 * argument with the same faces. The heading and the tone are props because
 * only the sentence around the wall differs between them.
 */

export type WallSpeaker = {
  id: string
  slug: string
  fullName: string
  title: string
  organisation: string
  photoUrl: string | null
}

export function SpeakerWall({
  speakers,
  eyebrow = 'Speakers',
  title = 'Who you will hear from',
  lead,
  linkLabel = 'See all speakers',
  tone = 'white',
}: {
  speakers: WallSpeaker[]
  eyebrow?: string
  title?: string
  lead?: string
  linkLabel?: string
  tone?: 'white' | 'muted'
}) {
  if (speakers.length === 0) return null

  return (
    <Section tone={tone} size="wide">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          lead={lead}
          className="mb-0"
        />
        <Link
          href="/events/speakers"
          className="inline-flex items-center gap-1.5 font-medium text-forest-700 hover:text-forest-800 hover:underline"
        >
          {linkLabel}
          <Icon name="arrowRight" className="size-4" />
        </Link>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {speakers.map((speaker) => (
          <li key={speaker.id}>
            <Link
              href={`/events/speakers/${speaker.slug}`}
              className="group relative block aspect-4/5 overflow-hidden rounded-xl bg-forest-800"
            >
              {speaker.photoUrl ? (
                // Remote CMS URL — see the note in ui/card.tsx.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={speaker.photoUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-full items-center justify-center font-display text-4xl font-bold text-white/25"
                >
                  {initials(speaker.fullName)}
                </span>
              )}

              {/* The scrim is what keeps the white name legible over a light
                  photograph — without it the contrast depends on whatever the
                  secretariat uploaded (NFR-09). */}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-2/3 bg-linear-to-t from-forest-950/95 via-forest-950/55 to-transparent"
              />

              <span className="absolute inset-x-0 bottom-0 p-4">
                <span className="block font-display text-sm font-semibold leading-tight text-white">
                  {speaker.fullName}
                </span>
                <span className="mt-1 block text-xs leading-tight text-white/75">
                  {truncate(speaker.title, 46)}
                </span>
                <span className="mt-0.5 block text-xs font-medium leading-tight text-gold-300">
                  {truncate(speaker.organisation, 40)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
