import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { MediaAssetManager } from '@/components/site/media-asset-manager'
import { MediaCollectionForm } from '@/components/site/media-collection-form'
import { Badge, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { MEDIA_KIND_LABELS, MediaKind } from '@/lib/enums'
import { fileKindLabel, formatBytes } from '@/lib/format'
import { Permission, requirePermission, userHas } from '@/lib/rbac'
import { uploadsEnabled } from '@/lib/uploads'

/**
 * One collection and the files in it (§4.14).
 *
 * `/admin/media/new` is the empty form; any other id loads that collection.
 * The files are on the same page rather than behind another click, because the
 * collection's settings and its contents are almost always looked at together
 * — the order of the photographs is the collection.
 *
 * The type and size shown against each file are derived on save rather than
 * typed, and they are shown back here for one reason: a file whose extension
 * lies about it — a PDF saved as `.doc` — is visible as a wrong label, which is
 * the only way an editor could ever notice.
 */

export const metadata: Metadata = {
  title: 'Media collection',
}

export default async function AdminMediaCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Adding and captioning is content work an editor does; removing a file for
  // good is not — see the note on CONTENT_DELETE in lib/rbac.
  const staff = await requirePermission(Permission.CONTENT_EDIT, {
    redirectTo: '/admin',
  })
  const canDelete = userHas(staff, Permission.CONTENT_DELETE)

  // Asked here rather than in the browser: the token is what the store checks,
  // and a tab left open through a deployment that removed the store would
  // otherwise still offer the button.
  const canUpload = uploadsEnabled()

  const { id } = await params
  const isNew = id === 'new'

  const collection = isNew
    ? null
    : await db.mediaCollection.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          kind: true,
          description: true,
          coverImageUrl: true,
          sortOrder: true,
          isPublished: true,
          assets: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              url: true,
              filename: true,
              mimeType: true,
              sizeBytes: true,
              title: true,
              altText: true,
              caption: true,
              thumbnailUrl: true,
              sortOrder: true,
              isPublic: true,
            },
          },
        },
      })

  if (!isNew && !collection) notFound()

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/media"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          All collections
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {isNew ? 'Add a collection' : collection!.name}
          </h1>
          {collection && (
            <p className="mt-2 text-sm text-ink-600">
              {MEDIA_KIND_LABELS[collection.kind as MediaKind] ??
                collection.kind}{' '}
              · {collection.assets.length} file
              {collection.assets.length === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {collection && (
          <div className="shrink-0">
            {collection.isPublished ? (
              <Badge tone="success">Public</Badge>
            ) : (
              <Badge tone="warning">Hidden</Badge>
            )}
          </div>
        )}
      </header>

      <Card>
        <MediaCollectionForm
          canDelete={canDelete}
          uploadsEnabled={canUpload}
          defaults={
            collection
              ? {
                  id: collection.id,
                  name: collection.name,
                  slug: collection.slug,
                  kind: collection.kind,
                  description: collection.description,
                  coverImageUrl: collection.coverImageUrl,
                  sortOrder: collection.sortOrder,
                  isPublished: collection.isPublished,
                  assetCount: collection.assets.length,
                }
              : null
          }
        />
      </Card>

      {/*
        Files appear only once the collection exists: they are added against its
        id, and a form that collected them before there was anything to attach
        them to would have to hold them somewhere while the collection saved.
      */}
      {collection && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-ink-950">
            Files
          </h2>

          <Card>
            <MediaAssetManager
              collectionId={collection.id}
              kind={collection.kind}
              canDelete={canDelete}
              uploadsEnabled={canUpload}
              assets={collection.assets.map((asset) => ({
                id: asset.id,
                url: asset.url,
                filename: asset.filename,
                title: asset.title,
                altText: asset.altText,
                caption: asset.caption,
                thumbnailUrl: asset.thumbnailUrl,
                sortOrder: asset.sortOrder,
                isPublic: asset.isPublic,
                typeLabel: fileKindLabel(asset.mimeType),
                // Empty for a file held elsewhere: its size is not this app's
                // to know, and formatBytes says nothing rather than "0 bytes".
                sizeLabel: formatBytes(asset.sizeBytes),
              }))}
            />
          </Card>
        </section>
      )}
    </div>
  )
}
