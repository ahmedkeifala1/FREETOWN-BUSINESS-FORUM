import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { SpeakerForm } from '@/components/site/speaker-form'
import { Badge, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { formatTimeRange } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Add or edit one speaker (§4.6).
 *
 * `/admin/speakers/new` is the empty form; any other id loads that profile.
 *
 * The sessions they are on are listed but not editable here — assignment is
 * done from the session, where the rest of the line-up is visible and the role
 * makes sense in context. Shown as links so that "which sessions is this
 * person on?" is answered on the page where it is asked.
 */

export const metadata: Metadata = {
  title: 'Speaker',
}

export default async function AdminSpeakerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission(Permission.EVENT_MANAGE, { redirectTo: '/admin' })

  const { id } = await params
  const isNew = id === 'new'

  const [speaker, sectors] = await Promise.all([
    isNew
      ? null
      : db.speaker.findUnique({
          where: { id },
          select: {
            id: true,
            fullName: true,
            slug: true,
            title: true,
            organisation: true,
            bio: true,
            photoUrl: true,
            country: true,
            sectorId: true,
            linkedinUrl: true,
            twitterUrl: true,
            websiteUrl: true,
            sortOrder: true,
            isFeatured: true,
            isPublished: true,
            sessions: {
              select: {
                role: true,
                session: {
                  select: {
                    id: true,
                    title: true,
                    dayNumber: true,
                    startsAt: true,
                    endsAt: true,
                  },
                },
              },
            },
          },
        }),
    db.sector.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  if (!isNew && !speaker) notFound()

  const appearances = (speaker?.sessions ?? [])
    .slice()
    .sort(
      (a, b) => a.session.startsAt.getTime() - b.session.startsAt.getTime(),
    )

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/speakers"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          All speakers
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {isNew ? 'Add a speaker' : speaker!.fullName}
          </h1>
          {speaker && (
            <p className="mt-2 text-sm text-ink-600">
              {speaker.title}, {speaker.organisation}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {speaker &&
            (speaker.isPublished ? (
              <Badge tone="success">Public</Badge>
            ) : (
              <Badge tone="warning">Draft</Badge>
            ))}
          {speaker?.isPublished && (
            <Link
              href={`/events/speakers/${speaker.slug}`}
              className="text-sm font-medium text-forest-700 hover:underline"
            >
              View live
            </Link>
          )}
        </div>
      </header>

      <Card>
        <SpeakerForm
          sectors={sectors}
          defaults={
            speaker
              ? {
                  id: speaker.id,
                  fullName: speaker.fullName,
                  slug: speaker.slug,
                  title: speaker.title,
                  organisation: speaker.organisation,
                  bio: speaker.bio,
                  photoUrl: speaker.photoUrl,
                  country: speaker.country,
                  sectorId: speaker.sectorId,
                  linkedinUrl: speaker.linkedinUrl,
                  twitterUrl: speaker.twitterUrl,
                  websiteUrl: speaker.websiteUrl,
                  sortOrder: speaker.sortOrder,
                  isFeatured: speaker.isFeatured,
                  isPublished: speaker.isPublished,
                  sessionCount: speaker.sessions.length,
                }
              : null
          }
        />
      </Card>

      {speaker && appearances.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink-950">
              On the programme
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              Change a line-up from the session itself.
            </p>
          </div>

          <Card padded={false}>
            <ul className="divide-y divide-ink-100">
              {appearances.map(({ role, session }) => (
                <li key={session.id}>
                  <Link
                    href={`/admin/programme/sessions/${session.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                  >
                    <span className="w-32 shrink-0 text-sm tabular-nums text-ink-600">
                      Day {session.dayNumber} ·{' '}
                      {formatTimeRange(session.startsAt, session.endsAt)}
                    </span>

                    <span className="min-w-0 flex-1 font-medium text-ink-950">
                      {session.title}
                    </span>

                    <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-500">
                      {role.toLowerCase()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}
