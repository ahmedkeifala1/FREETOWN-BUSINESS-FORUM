import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Avatar, Badge, Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { initials } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Speakers (§4.6).
 *
 * One list for every forum, because a Speaker is not scoped to an event — the
 * same people come back, and a per-forum list would be the same biographies
 * typed twice. Which sessions a speaker is on is set from the session, so this
 * screen shows the count and leaves the scheduling to the programme.
 *
 * Unpublished first, then by the order they are shown in publicly. The
 * unfinished profiles are the ones with something left to do on them, and a
 * list that buries them at the bottom is a list that hides its own work.
 */

export const metadata: Metadata = {
  title: 'Speakers',
}

export default async function AdminSpeakersPage() {
  await requirePermission(Permission.EVENT_MANAGE, { redirectTo: '/admin' })

  const speakers = await db.speaker.findMany({
    orderBy: [
      { isPublished: 'asc' },
      { sortOrder: 'asc' },
      { fullName: 'asc' },
    ],
    take: 300,
    select: {
      id: true,
      fullName: true,
      title: true,
      organisation: true,
      photoUrl: true,
      country: true,
      isFeatured: true,
      isPublished: true,
      sector: { select: { name: true } },
      _count: { select: { sessions: true } },
    },
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Speakers
          </h1>
          <p className="mt-2 leading-relaxed text-ink-600">
            Profiles for the speakers page and the homepage wall. Put them on
            sessions from the programme.
          </p>
        </div>

        <ButtonLink href="/admin/speakers/new" size="md">
          Add a speaker
        </ButtonLink>
      </header>

      {speakers.length === 0 ? (
        <EmptyState
          title="No speakers yet"
          message="Add a profile for each confirmed speaker, then put them on their sessions from the programme."
        >
          <ButtonLink href="/admin/speakers/new" size="md">
            Add the first speaker
          </ButtonLink>
        </EmptyState>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {speakers.map((speaker) => (
              <li key={speaker.id}>
                <Link
                  href={`/admin/speakers/${speaker.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                >
                  <Avatar
                    src={speaker.photoUrl}
                    name={speaker.fullName}
                    initials={initials(speaker.fullName)}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-950">
                      {speaker.fullName}
                    </p>
                    <p className="truncate text-sm text-ink-600">
                      {speaker.title}, {speaker.organisation}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {speaker.sector?.name && `${speaker.sector.name} · `}
                      {speaker.country && `${speaker.country} · `}
                      {speaker._count.sessions === 0
                        ? 'not on the programme'
                        : `${speaker._count.sessions} session${speaker._count.sessions === 1 ? '' : 's'}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {speaker.isFeatured && (
                      <span className="text-xs font-medium uppercase tracking-wider text-gold-700">
                        Featured
                      </span>
                    )}
                    {speaker.isPublished ? (
                      <Badge tone="success">Public</Badge>
                    ) : (
                      <Badge tone="warning">Draft</Badge>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
