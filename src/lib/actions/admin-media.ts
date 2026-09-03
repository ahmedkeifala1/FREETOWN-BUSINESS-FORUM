'use server'

import { stat } from 'node:fs/promises'
import path from 'node:path'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import { assertPermission, Permission } from '@/lib/rbac'
import {
  mediaAssetSchema,
  mediaCollectionSchema,
  parseForm,
} from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Media collections and the files in them (§4.14).
 *
 * The gallery on the homepage, the film band, the recordings page and the
 * downloads page all read these rows, and until now only the seed wrote them.
 * This is the screen that lets the secretariat put this year's photographs on
 * the wall themselves.
 *
 * **An asset is a *reference* to a file** — a path this site already serves
 * under `public/`, a file in the blob store, or a full address on whatever
 * platform holds it. The distinction is load-bearing rather than incidental:
 * the homepage plays a `/`-relative film in place and links a hosted one out to
 * its host, so flattening the two would change what the page does.
 *
 * Files can now be uploaded, and nothing below changed to allow it. The upload
 * happens in the browser against object storage and yields an address, which is
 * posted into the same `url` field that was always here — see `lib/uploads`.
 * This action still only ever stores a string.
 *
 * **An asset's kind comes from its collection**, and its MIME type and size
 * come from the file. Everything that can be derived is, because every field an
 * editor has to type twice is a field that will eventually disagree with
 * itself: the public queries filter on the asset kind *and* the collection, so
 * a photograph filed as a download inside a gallery would simply vanish.
 */

/**
 * Every public surface that reads media.
 *
 * The homepage takes both the hero mosaic and the film band from collections,
 * the Learning Hub counts them, and the forum overview page shows the gallery
 * again — so a single photograph is rarely a single-page change.
 */
function revalidateMedia(): void {
  revalidatePath('/')
  revalidatePath('/events')
  revalidatePath('/membership')
  revalidatePath('/learning-hub')
  revalidatePath('/learning-hub/recordings')
  revalidatePath('/learning-hub/downloads')
}

/**
 * What a file's extension says it is.
 *
 * The extension is a weak signal — `lib/format`'s `fileKindLabel` says as much
 * — but for a file this app only ever links to it is the only signal there is,
 * and it is better than asking the secretariat for a MIME type. Anything
 * unrecognised is stored as `application/octet-stream`, which renders as the
 * honest "File" rather than a confident wrong label like "PDF".
 */
const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  csv: 'text/csv',
}

/**
 * The path part of an asset address, whether it is local or remote.
 *
 * A relative address is resolved against a placeholder origin purely so that
 * one code path handles both — the origin is thrown away.
 */
function pathnameOf(url: string): string {
  try {
    return new URL(url, 'https://fbf.sl').pathname
  } catch {
    return url
  }
}

function mimeTypeFor(url: string): string {
  const extension = pathnameOf(url).split('.').pop()?.toLowerCase() ?? ''
  return MIME_TYPES[extension] ?? 'application/octet-stream'
}

/**
 * The name to file the asset under.
 *
 * The last segment of the path, which is the real filename for anything this
 * site serves. A platform URL rarely has one worth showing — the last segment
 * of a watch link is "watch" — so the title is preferred when there is one, and
 * the downloads page falls back to this only when there is not.
 */
function filenameFor(url: string, title: string | null): string {
  const segment = decodeURIComponent(pathnameOf(url).split('/').pop() ?? '')

  if (segment.includes('.')) return segment.slice(0, 200)

  return (title ?? segment ?? 'file').slice(0, 200) || 'file'
}

/**
 * How big the file is, read from the file itself.
 *
 * Never typed. A byte count someone looked up is stale the moment the file is
 * replaced, and the downloads page prints it next to the link — "PDF, 2.4 MB"
 * is a promise about what a delegate on a metered connection is about to pay
 * for.
 *
 * Two sources, because there are now two kinds of file. One this site serves is
 * on disk under `public/` and is measured with `stat`. Anything else is asked
 * for its `Content-Length` with a HEAD request, which is how an uploaded file
 * in the blob store gets a size at all — that is the common case since uploads
 * landed, and leaving every uploaded PDF at 0 would quietly empty the size
 * label the downloads page was built around.
 *
 * Both paths return 0 rather than throwing. A file that is not there yet is not
 * an error: an editor may well add the row before the photographs are copied
 * into the deployment, and `formatBytes` renders 0 as nothing at all rather
 * than as "0 bytes".
 */
async function sizeOf(url: string): Promise<number> {
  if (!url.startsWith('/')) return remoteSizeOf(url)

  const root = path.join(process.cwd(), 'public')
  const target = path.resolve(root, `.${decodeURIComponent(pathnameOf(url))}`)

  // The address has already been through `assetUrlSchema`, which rejects
  // anything not beginning with a single slash, but a `..` inside an otherwise
  // valid path would still climb out of the directory — and this runs as the
  // server.
  if (target !== root && !target.startsWith(root + path.sep)) return 0

  try {
    const info = await stat(target)
    return info.isFile() ? info.size : 0
  } catch {
    return 0
  }
}

/**
 * The size a remote host reports for a file, or 0 if it will not say.
 *
 * A HEAD is used rather than a range request because the only thing wanted is
 * the header; nothing downloads the file. The timeout matters more than it
 * looks: this runs inside the save, so a host that accepts the connection and
 * then never answers would hold the editor's form open until the function
 * itself timed out. Three seconds is longer than any store needs and shorter
 * than anyone waits.
 *
 * Every failure — a refused HEAD, a redirect chain, a host that omits the
 * header, a plain 404 — lands on 0, which is the same "we do not know" the
 * local path returns for a file that has not been copied in yet.
 */
async function remoteSizeOf(url: string): Promise<number> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) return 0

    const length = Number(response.headers.get('content-length'))
    return Number.isFinite(length) && length > 0 ? length : 0
  } catch {
    return 0
  }
}

// ── Collections ─────────────────────────────────────────────────────────────

/**
 * Create or rename a collection.
 *
 * The slug matters more here than it does elsewhere in the admin panel: the
 * homepage looks the hero mosaic up by `forum-gallery` and the film band by
 * `forum-videos`, so renaming one of those empties the band on the front page
 * without any error anywhere. The form says so, and the two the homepage reads
 * are named in the hint rather than left to be discovered.
 */
export async function saveCollection(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.CONTENT_EDIT)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(mediaCollectionSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const collectionId = String(formData.get('collectionId') ?? '') || null

  const existing = collectionId
    ? await db.mediaCollection.findUnique({
        where: { id: collectionId },
        select: { id: true, kind: true },
      })
    : null

  if (collectionId && !existing) {
    return errorState('That collection no longer exists.')
  }

  const clash = await db.mediaCollection.findFirst({
    where: {
      slug: data.slug,
      ...(existing ? { id: { not: existing.id } } : {}),
    },
    select: { id: true },
  })

  if (clash) {
    return fieldErrors({
      slug: 'Another collection already uses that reference.',
    })
  }

  const values = {
    name: data.name,
    slug: data.slug,
    kind: data.kind,
    description: data.description ?? null,
    coverImageUrl: data.coverImageUrl ?? null,
    sortOrder: data.sortOrder,
    isPublished: data.isPublished,
  }

  let saved: { id: string; name: string }

  try {
    /*
      Changing the kind of a collection carries its files with it.

      The assets took their kind from the collection when they were added, and
      the public queries match on both, so leaving them behind would hide every
      file in the collection the moment its kind changed — a silent emptying,
      which is precisely the failure the derived kind exists to prevent.
    */
    saved = await db.$transaction(async (tx) => {
      const row = existing
        ? await tx.mediaCollection.update({
            where: { id: existing.id },
            data: values,
            select: { id: true, name: true },
          })
        : await tx.mediaCollection.create({
            data: values,
            select: { id: true, name: true },
          })

      if (existing && existing.kind !== data.kind) {
        await tx.mediaAsset.updateMany({
          where: { collectionId: existing.id },
          data: { kind: data.kind },
        })
      }

      return row
    })
  } catch {
    return errorState(
      'We could not save that collection just now. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.MEDIA_UPDATE,
    entityType: 'MediaCollection',
    entityId: saved.id,
    summary: `${existing ? 'Updated' : 'Created'} media collection ${saved.name} — ${
      data.isPublished ? 'published' : 'unpublished'
    }.`,
    metadata: { slug: data.slug, kind: data.kind, isPublished: data.isPublished },
  })

  revalidateMedia()

  if (!existing) redirect(`/admin/media/${saved.id}`)

  return successState(
    data.isPublished ? 'Saved and live.' : 'Saved. Not shown publicly.',
  )
}

/**
 * Delete an empty collection.
 *
 * Refused while it still holds files, rather than cascading. Deleting the row
 * would take the captions and the running order with it while leaving the files
 * themselves on disk, and nothing afterwards would say what the collection used
 * to contain — so emptying it is made an explicit, visible step.
 */
export async function deleteCollection(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.CONTENT_DELETE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const collectionId = String(formData.get('collectionId') ?? '')

  const collection = collectionId
    ? await db.mediaCollection.findUnique({
        where: { id: collectionId },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { assets: true } },
        },
      })
    : null

  if (!collection) return errorState('That collection no longer exists.')

  if (collection._count.assets > 0) {
    return errorState(
      `${collection.name} still holds ${collection._count.assets} file${
        collection._count.assets === 1 ? '' : 's'
      }. Remove them first, or untick “Show on the public site” to hide the collection instead.`,
    )
  }

  try {
    await db.mediaCollection.delete({ where: { id: collection.id } })
  } catch {
    return errorState('We could not delete that collection just now.')
  }

  await record({
    userId: staff.id,
    action: AuditAction.MEDIA_DELETE,
    entityType: 'MediaCollection',
    entityId: collection.id,
    summary: `Deleted the empty media collection ${collection.name}.`,
    metadata: { slug: collection.slug },
  })

  revalidateMedia()

  redirect('/admin/media')
}

// ── Assets ──────────────────────────────────────────────────────────────────

/**
 * Add a file to a collection, or edit the one already there.
 *
 * The address is editable on an existing asset because that is how a replaced
 * photograph is handled — the caption, the alt text and the place in the
 * running order all stay, and only the file behind them changes. The derived
 * fields are all recomputed on every save for exactly that reason.
 */
export async function saveAsset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.CONTENT_EDIT)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(mediaAssetSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const assetId = String(formData.get('assetId') ?? '') || null

  const collection = await db.mediaCollection.findUnique({
    where: { id: data.collectionId },
    select: { id: true, kind: true, name: true },
  })

  if (!collection) return errorState('That collection no longer exists.')

  if (assetId) {
    const existing = await db.mediaAsset.findUnique({
      where: { id: assetId },
      select: { id: true },
    })
    if (!existing) return errorState('That file is no longer in the library.')
  }

  const values = {
    collectionId: collection.id,
    kind: collection.kind,
    url: data.url,
    filename: filenameFor(data.url, data.title ?? null),
    mimeType: mimeTypeFor(data.url),
    sizeBytes: await sizeOf(data.url),
    title: data.title ?? null,
    altText: data.altText ?? null,
    caption: data.caption ?? null,
    thumbnailUrl: data.thumbnailUrl ?? null,
    sortOrder: data.sortOrder,
    isPublic: data.isPublic,
  }

  let saved: { id: string; filename: string }

  try {
    saved = assetId
      ? await db.mediaAsset.update({
          where: { id: assetId },
          data: values,
          select: { id: true, filename: true },
        })
      : await db.mediaAsset.create({
          // Who added it is recorded on creation only: the uploader is the
          // person who brought the file in, and a later caption fix does not
          // make the person fixing it the source of the photograph.
          data: { ...values, uploadedById: staff.id },
          select: { id: true, filename: true },
        })
  } catch {
    return errorState(
      'We could not save that file just now. Please try again shortly.',
    )
  }

  await record({
    userId: staff.id,
    action: AuditAction.MEDIA_UPDATE,
    entityType: 'MediaAsset',
    entityId: saved.id,
    summary: `${assetId ? 'Updated' : 'Added'} ${saved.filename} in ${collection.name}.`,
    metadata: { url: data.url, collection: collection.name, isPublic: data.isPublic },
  })

  revalidateMedia()

  return successState(
    data.isPublic ? 'Saved and live.' : 'Saved. Hidden from the public site.',
  )
}

/**
 * Take a file out of a collection.
 *
 * The row goes; the file itself stays wherever it is served from, which is the
 * only thing this app can promise — it did not put it there. Recorded as its
 * own audit action because a removal is the one media change that leaves
 * nothing behind to look at afterwards.
 */
export async function deleteAsset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.CONTENT_DELETE)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const assetId = String(formData.get('assetId') ?? '')

  const asset = assetId
    ? await db.mediaAsset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          filename: true,
          url: true,
          collection: { select: { name: true } },
        },
      })
    : null

  if (!asset) return errorState('That file is no longer in the library.')

  try {
    await db.mediaAsset.delete({ where: { id: asset.id } })
  } catch {
    return errorState('We could not remove that file just now.')
  }

  await record({
    userId: staff.id,
    action: AuditAction.MEDIA_DELETE,
    entityType: 'MediaAsset',
    entityId: asset.id,
    summary: `Removed ${asset.filename} from ${asset.collection?.name ?? 'the library'}.`,
    metadata: { url: asset.url },
  })

  revalidateMedia()

  return successState(`${asset.filename} was removed.`)
}
