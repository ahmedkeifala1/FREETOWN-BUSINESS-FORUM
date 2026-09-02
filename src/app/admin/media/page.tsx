import Link from 'next/link'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { MEDIA_KIND_LABELS, type MediaKind } from '@/lib/enums'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * The media library (§4.14).
 *
 * Organised as collections rather than as one long list of files, because that
 * is how the public pages read it: the homepage takes its photo wall from one
 * collection and its film band from another, the recordings page shows the
 * video collections and the downloads page the document ones. A flat library
 * with a tag on each file would put the ordering somewhere other than where the
 * ordering is decided.
 *
 * A collection holding nothing is still shown — the public pages skip empty
 * ones, and a collection made ready for next year's photographs is a normal
 * state rather than a fault to hide.
 */

export const metadata: Metadata = {
  title: 'Media',
}

export default async function AdminMediaPage() {
  await requirePermission(Permission.CONTENT_EDIT, { redirectTo: '/admin' })

  const collections = await db.mediaCollection.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      kind: true,
      description: true,
      isPublished: true,
      _count: { select: { assets: true } },
    },
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Media
          </h1>
          <p className="mt-2 max-w-prose leading-relaxed text-ink-600">
            Photographs, film and documents, grouped as the public pages read
            them. Files are added by address — a path this site already serves,
            or a link to the platform holding them — rather than uploaded here.
          </p>
        </div>

        <ButtonLink href="/admin/media/new" size="md">
          Add a collection
        </ButtonLink>
      </header>

      {collections.length === 0 ? (
        <EmptyState
          title="No collections yet"
          message="A collection groups files for one place on the site — the homepage gallery, the recordings page, the downloads page."
        >
          <ButtonLink href="/admin/media/new" size="md">
            Create the first collection
          </ButtonLink>
        </EmptyState>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {collections.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/admin/media/${collection.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-950">
                      {collection.name}
                    </p>
                    {collection.description && (
                      <p className="truncate text-sm text-ink-600">
                        {collection.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm text-ink-500">
                      {MEDIA_KIND_LABELS[collection.kind as MediaKind] ??
                        collection.kind}{' '}
                      · {collection.slug} ·{' '}
                      {collection._count.assets === 0
                        ? 'empty'
                        : `${collection._count.assets} file${
                            collection._count.assets === 1 ? '' : 's'
                          }`}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {collection.isPublished ? (
                      <Badge tone="success">Public</Badge>
                    ) : (
                      <Badge tone="warning">Hidden</Badge>
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
