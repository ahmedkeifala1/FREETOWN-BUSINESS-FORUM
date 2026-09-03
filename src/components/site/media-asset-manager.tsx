'use client'

import { useActionState } from 'react'

import {
  Checkbox,
  Field,
  FormMessage,
  Input,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import { Icon } from '@/components/ui/icon'
import { UploadField, type UploadKindName } from '@/components/ui/upload'
import { deleteAsset, saveAsset } from '@/lib/actions/admin-media'
import { idleState } from '@/lib/actions/types'
import { MediaKind } from '@/lib/enums'

/**
 * The files in one collection (§4.14).
 *
 * Edited in place in the list, like tracks, rather than on a page each: the
 * work here is almost always ordering and captioning a set of photographs
 * together, and a round trip per caption would make a morning of it. Each row
 * is its own component so that its pending and error state belong to it alone.
 *
 * Rows are collapsed into a disclosure because the summary line — thumbnail,
 * name, order, whether it is public — is what the person scanning the list came
 * for, and the eight fields behind it are not.
 *
 * An asset is still an *address* — a path this site serves, a file on the
 * platform that holds it, or a file in the blob store. What changed is that
 * the address can now be arrived at by choosing a file rather than only by
 * typing: `UploadField` puts the uploaded file's address into the same input
 * that was always there, so the action behind this form is unchanged. See
 * lib/uploads for why the upload does not pass through the server.
 */

export type AssetRow = {
  id: string
  url: string
  filename: string
  title: string | null
  altText: string | null
  caption: string | null
  thumbnailUrl: string | null
  sortOrder: number
  isPublic: boolean
  /** Derived on save and shown back, so a mislabelled file can be spotted. */
  typeLabel: string
  sizeLabel: string
}

export function MediaAssetManager({
  collectionId,
  kind,
  assets,
  canDelete,
  uploadsEnabled,
}: {
  collectionId: string
  kind: string
  assets: AssetRow[]
  canDelete: boolean
  /** Whether a blob store is attached — see lib/uploads. Decided on the server. */
  uploadsEnabled: boolean
}) {
  return (
    <div className="space-y-6">
      {assets.length > 0 && (
        <ul className="divide-y divide-ink-100">
          {assets.map((asset) => (
            <li key={asset.id} className="py-4 first:pt-0">
              <ExistingAsset
                collectionId={collectionId}
                kind={kind}
                asset={asset}
                canDelete={canDelete}
                uploadsEnabled={uploadsEnabled}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-ink-200 pt-6">
        <p className="mb-4 font-display text-base font-semibold text-ink-950">
          Add a file
        </p>
        <NewAsset
          collectionId={collectionId}
          kind={kind}
          uploadsEnabled={uploadsEnabled}
        />
      </div>
    </div>
  )
}

/**
 * Which upload allow-list a collection's files are checked against.
 *
 * The collection's kind already decides what its files are, so the upload
 * limits follow it rather than being a second choice for the editor to get
 * wrong — a gallery accepts images, a recordings collection accepts films.
 * `DOCUMENT` is the fallback for anything unmapped, because its list is the
 * one that admits the widest range of ordinary office files.
 */
const UPLOAD_KIND_FOR: Record<string, UploadKindName> = {
  [MediaKind.GALLERY]: 'image',
  [MediaKind.VIDEO]: 'video',
  [MediaKind.DOWNLOAD]: 'document',
}

/**
 * The fields shared by the add and edit forms — one definition, so the two
 * cannot drift apart.
 *
 * Which fields are shown depends on the kind of the collection, because the
 * questions genuinely differ: a photograph needs alt text and a film needs a
 * poster frame, and asking a document for either is asking for a blank.
 */
function AssetFields({
  kind,
  defaults,
  errors,
  uploadsEnabled,
}: {
  kind: string
  defaults?: Partial<AssetRow>
  errors?: Record<string, string>
  uploadsEnabled: boolean
}) {
  return (
    <div className="space-y-5">
      <Field
        label="File address"
        name="url"
        hint={
          kind === MediaKind.VIDEO
            ? 'A path such as /brand/video/highlights.mp4 plays on the site itself. A full address on YouTube or Vimeo is linked out to its host instead.'
            : 'A path such as /brand/hero/one.jpg for a file this site serves, or a full https:// address elsewhere.'
        }
        error={errors?.url}
        required
      >
        <UploadField
          name="url"
          kind={UPLOAD_KIND_FOR[kind] ?? 'document'}
          enabled={uploadsEnabled}
          defaultValue={defaults?.url ?? ''}
          placeholder="/brand/hero/one.jpg"
          required
          error={errors?.url}
        />
      </Field>

      <Field
        label="Title"
        name="title"
        hint="What it is called on the public page. Without one, the filename is shown."
        error={errors?.title}
      >
        <Input
          name="title"
          defaultValue={defaults?.title ?? ''}
          error={errors?.title}
        />
      </Field>

      {kind === MediaKind.GALLERY && (
        <Field
          label="Alt text"
          name="altText"
          hint="What the photograph shows, for anyone who cannot see it. Describe the scene, not the fact that it is a photograph."
          error={errors?.altText}
        >
          <Input
            name="altText"
            defaultValue={defaults?.altText ?? ''}
            placeholder="Delegates in conversation during the opening plenary"
            error={errors?.altText}
          />
        </Field>
      )}

      {kind === MediaKind.VIDEO && (
        <Field
          label="Poster frame"
          name="thumbnailUrl"
          hint="The still shown before the film is played. Without one the first frame is used, which is often black."
          error={errors?.thumbnailUrl}
        >
          <UploadField
            name="thumbnailUrl"
            kind="image"
            enabled={uploadsEnabled}
            defaultValue={defaults?.thumbnailUrl ?? ''}
            placeholder="/brand/video/highlights-poster.jpg"
            error={errors?.thumbnailUrl}
          />
        </Field>
      )}

      <Field
        label="Caption"
        name="caption"
        hint="A line of context under the file. Optional."
        error={errors?.caption}
      >
        <Textarea
          name="caption"
          rows={2}
          defaultValue={defaults?.caption ?? ''}
          error={errors?.caption}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Order"
          name="sortOrder"
          hint="Low first"
          error={errors?.sortOrder}
          className="max-w-32"
        >
          <Input
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={defaults?.sortOrder ?? 0}
            error={errors?.sortOrder}
          />
        </Field>

        <div className="self-end pb-2.5">
          <Checkbox
            name="isPublic"
            defaultChecked={defaults?.isPublic ?? true}
            label="Show on the public site"
          />
        </div>
      </div>
    </div>
  )
}

function NewAsset({
  collectionId,
  kind,
  uploadsEnabled,
}: {
  collectionId: string
  kind: string
  uploadsEnabled: boolean
}) {
  const [state, formAction] = useActionState(saveAsset, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    /*
      Keyed on the success message so a saved form clears — otherwise the file
      just added stays typed into the "add" row and invites being added twice,
      which in a gallery means the same photograph on the wall twice.
    */
    <form
      key={state.status === 'success' ? state.message : 'new'}
      action={formAction}
      className="space-y-5"
    >
      <input type="hidden" name="collectionId" value={collectionId} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <AssetFields kind={kind} errors={errors} uploadsEnabled={uploadsEnabled} />

      <SubmitButton variant="outline" size="sm" pendingLabel="Adding…">
        Add file
      </SubmitButton>
    </form>
  )
}

function ExistingAsset({
  collectionId,
  kind,
  asset,
  canDelete,
  uploadsEnabled,
}: {
  collectionId: string
  kind: string
  asset: AssetRow
  canDelete: boolean
  uploadsEnabled: boolean
}) {
  const [saveState, saveAction] = useActionState(saveAsset, idleState)
  const [deleteState, deleteAction] = useActionState(deleteAsset, idleState)

  const errors = saveState.status === 'error' ? saveState.errors : undefined

  const meta = [asset.typeLabel, asset.sizeLabel, `order ${asset.sortOrder}`]
    .filter(Boolean)
    .join(' · ')

  // A film has a poster frame or nothing worth showing; a photograph is its own
  // thumbnail; a document is neither.
  const preview =
    asset.thumbnailUrl ?? (kind === MediaKind.GALLERY ? asset.url : null)

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-4 rounded-lg px-2 py-2 transition-colors hover:bg-ink-50">
        {/*
          A picture only when there is a picture. A document's address in an
          `<img>` is a broken-image icon beside every row of the downloads
          collection, which reads as a fault in the file rather than as what it
          is — a PDF, which has no thumbnail.

          Plain `<img>` rather than next/image, as elsewhere in the site: the
          address may be on another host entirely, and the optimiser refuses any
          domain not configured ahead of time.
        */}
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="size-12 shrink-0 rounded-md bg-ink-100 object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
            <Icon name="document" className="size-5" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink-950">
            {asset.title ?? asset.filename}
          </span>
          <span className="block truncate text-sm text-ink-500">{meta}</span>
        </span>

        {!asset.isPublic && (
          <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-amber-700">
            Hidden
          </span>
        )}

        <span className="shrink-0 text-sm text-forest-700 group-open:hidden">
          Edit
        </span>
      </summary>

      <div className="space-y-5 px-2 pb-2 pt-5">
        {saveState.status === 'success' && (
          <FormMessage status="success">{saveState.message}</FormMessage>
        )}

        {saveState.status === 'error' && saveState.message && !errors && (
          <FormMessage status="error">{saveState.message}</FormMessage>
        )}

        {deleteState.status === 'error' && deleteState.message && (
          <FormMessage status="error">{deleteState.message}</FormMessage>
        )}

        <form action={saveAction} className="space-y-5">
          <input type="hidden" name="collectionId" value={collectionId} />
          <input type="hidden" name="assetId" value={asset.id} />

          <AssetFields
            kind={kind}
            defaults={asset}
            errors={errors}
            uploadsEnabled={uploadsEnabled}
          />

          <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>

        {/*
          A separate form, not another button inside the one above: removing a
          file must not carry the half-typed edits sitting in those fields.
        */}
        {canDelete && (
          <form action={deleteAction}>
            <input type="hidden" name="assetId" value={asset.id} />
            <SubmitButton variant="ghost" size="sm" pendingLabel="Removing…">
              Remove from this collection
            </SubmitButton>
          </form>
        )}
      </div>
    </details>
  )
}
