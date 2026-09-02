import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { TrackManager } from '@/components/site/track-form'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Tracks for one forum (§4.5).
 *
 * A page of its own rather than a panel on the programme, because tracks are
 * set up once at the start and then left alone — putting them beside the
 * sessions would give the screen that is used every day a block that is used
 * twice a year.
 */

export const metadata: Metadata = {
  title: 'Tracks',
}

export default async function AdminTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  await requirePermission(Permission.EVENT_MANAGE, { redirectTo: '/admin' })

  const { event: requestedEvent } = await searchParams

  // Same fallback as the programme: the current forum unless one is named.
  const event = requestedEvent
    ? await db.event.findUnique({
        where: { id: requestedEvent },
        select: { id: true, name: true },
      })
    : await db.event.findFirst({
        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
        select: { id: true, name: true },
      })

  if (!event) notFound()

  const tracks = await db.track.findMany({
    where: { eventId: event.id },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      colour: true,
      sortOrder: true,
      _count: { select: { sessions: true } },
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/programme?event=${event.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          Programme
        </Link>
      </div>

      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">Tracks</h1>
        <p className="mt-2 max-w-prose leading-relaxed text-ink-600">
          The parallel streams of {event.name}. Delegates filter the agenda by
          them, and each session carries its track’s colour. A forum that runs
          one room at a time needs none at all.
        </p>
      </header>

      <Card>
        <TrackManager
          eventId={event.id}
          tracks={tracks.map((track) => ({
            id: track.id,
            name: track.name,
            colour: track.colour,
            sortOrder: track.sortOrder,
            sessionCount: track._count.sessions,
          }))}
        />
      </Card>
    </div>
  )
}
