import { LinkCard } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { SESSION_TYPE_LABELS, type SessionType } from '@/lib/enums'
import { formatTime, initials } from '@/lib/format'

/**
 * One programme session, as a photo-forward card (§4.2, §4.10).
 *
 * The card leads with the first speaker's photograph, because a face is what
 * makes someone stop on a session they have not heard of. It deep-links into
 * the agenda rather than to a session page of its own — the agenda is where
 * the room, the track and the neighbouring sessions are, which is what someone
 * clicking "Find out more" actually wants next.
 *
 * Lifted out of the homepage when the membership page needed the same card.
 * Both pages show the programme to persuade rather than to inform, so they
 * must not drift into looking like two different products; a card that exists
 * once cannot drift.
 */

export type SessionCardSession = {
  id: string
  slug: string
  title: string
  dayNumber: number
  startsAt: Date
  sessionType: string
  speakers: Array<{
    speaker: { fullName: string; photoUrl: string | null; organisation: string }
  }>
}

export function SessionCard({ session }: { session: SessionCardSession }) {
  const lead = session.speakers[0]?.speaker
  const others = session.speakers.length - 1

  return (
    <LinkCard
      href={`/events/agenda#${session.slug}`}
      className="h-full overflow-hidden"
      padded={false}
    >
      <div className="relative h-44 bg-forest-800">
        {lead?.photoUrl ? (
          // CMS image URLs are arbitrary remote hosts, so next/image cannot be
          // used here — see the note in ui/card.tsx.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lead.photoUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-full items-center justify-center font-display text-4xl font-bold text-white/25"
          >
            {lead ? initials(lead.fullName) : 'FBF'}
          </span>
        )}

        <span className="absolute left-4 top-4 inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink-900">
          Day {session.dayNumber} · {formatTime(session.startsAt)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
          {SESSION_TYPE_LABELS[session.sessionType as SessionType] ?? 'Session'}
        </p>

        <h3 className="mt-2 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
          {session.title}
        </h3>

        {lead && (
          <p className="mt-2 text-sm text-ink-600">
            {lead.fullName}, {lead.organisation}
            {others > 0 && ` +${others} more`}
          </p>
        )}

        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
          Find out more
          <Icon name="arrowRight" className="size-4" />
        </span>
      </div>
    </LinkCard>
  )
}
