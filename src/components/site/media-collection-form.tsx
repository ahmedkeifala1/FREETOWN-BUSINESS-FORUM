'use client'

import { useActionState } from 'react'

import {
  Checkbox,
  ErrorSummary,
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui/form'
import {
  deleteCollection,
  saveCollection,
} from '@/lib/actions/admin-media'
import { idleState } from '@/lib/actions/types'
import { MEDIA_KIND_LABELS, MediaKind } from '@/lib/enums'

/**
 * A media collection (§4.14).
 *
 * Three things about it are worth knowing while editing one, and the form says
 * all three rather than assuming the reader knows the site by heart.
 *
 * The **reference** is not decoration. The homepage looks its photo wall up by
 * `forum-gallery` and its film band by `forum-videos`, so renaming either of
 * those empties a band on the front page with no error anywhere.
 *
 * The **type** decides which public page the collection appears on, and the
 * files inside it follow the collection when it changes.
 *
 * **Deleting** is offered only when the collection is empty and only to an
 * administrator; everyone else hides it instead.
 */

export type CollectionDefaults = {
  id: string
  name: string
  slug: string
  kind: string
  description: string | null
  coverImageUrl: string | null
  sortOrder: number
  isPublished: boolean
  assetCount: number
}

export function MediaCollectionForm({
  defaults,
  canDelete,
}: {
  defaults: CollectionDefaults | null
  canDelete: boolean
}) {
  const [state, formAction] = useActionState(saveCollection, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-6">
        {defaults && (
          <input type="hidden" name="collectionId" value={defaults.id} />
        )}

        <ErrorSummary errors={errors} />

        {state.status === 'success' && (
          <FormMessage status="success">{state.message}</FormMessage>
        )}

        {state.status === 'error' && state.message && !errors && (
          <FormMessage status="error">{state.message}</FormMessage>
        )}

        <Field label="Name" name="name" error={errors?.name} required>
          <Input
            name="name"
            defaultValue={defaults?.name ?? ''}
            placeholder="Forum photo gallery"
            required
            error={errors?.name}
          />
        </Field>

        <Field
          label="Reference"
          name="slug"
          hint="The homepage reads forum-gallery for its photo wall and forum-videos for its film band. Renaming either of those empties that band."
          error={errors?.slug}
          required
        >
          <Input
            name="slug"
            defaultValue={defaults?.slug ?? ''}
            placeholder="forum-gallery"
            required
            error={errors?.slug}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Type"
            name="kind"
            hint="Decides where it appears: photographs in galleries, film on the recordings page, everything else under downloads."
            error={errors?.kind}
            required
          >
            <Select
              name="kind"
              defaultValue={defaults?.kind ?? MediaKind.GALLERY}
              error={errors?.kind}
            >
              {Object.values(MediaKind).map((kind) => (
                <option key={kind} value={kind}>
                  {MEDIA_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Order"
            name="sortOrder"
            hint="Low first"
            error={errors?.sortOrder}
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
        </div>

        <Field
          label="Description"
          name="description"
          hint="A sentence under the heading on the public page."
          error={errors?.description}
        >
          <Textarea
            name="description"
            rows={3}
            defaultValue={defaults?.description ?? ''}
            error={errors?.description}
          />
        </Field>

        <Field
          label="Cover image"
          name="coverImageUrl"
          hint="A path on this site such as /brand/hero/one.jpg, or a full address elsewhere."
          error={errors?.coverImageUrl}
        >
          <Input
            name="coverImageUrl"
            defaultValue={defaults?.coverImageUrl ?? ''}
            placeholder="/brand/hero/one.jpg"
            error={errors?.coverImageUrl}
          />
        </Field>

        <Checkbox
          name="isPublished"
          defaultChecked={defaults?.isPublished ?? true}
          label={
            <>
              Show on the public site
              <span className="mt-0.5 block text-ink-500">
                Hiding a collection hides every file in it at once, without
                touching the files or their order.
              </span>
            </>
          }
        />

        <div className="border-t border-ink-200 pt-6">
          <SubmitButton size="md" pendingLabel="Saving…">
            {defaults ? 'Save changes' : 'Create collection'}
          </SubmitButton>
        </div>
      </form>

      {defaults && canDelete && (
        <RemoveCollection
          collectionId={defaults.id}
          assetCount={defaults.assetCount}
        />
      )}
    </div>
  )
}

/**
 * Deleting the collection.
 *
 * Not drawn while it still holds files — the action refuses that anyway, and
 * the sentence in its place names emptying it as the thing to do first.
 */
function RemoveCollection({
  collectionId,
  assetCount,
}: {
  collectionId: string
  assetCount: number
}) {
  const [state, formAction] = useActionState(deleteCollection, idleState)

  if (assetCount > 0) {
    return (
      <div className="border-t border-ink-200 pt-6">
        <p className="max-w-prose text-sm text-ink-600">
          This collection holds {assetCount} file
          {assetCount === 1 ? '' : 's'}, so it cannot be deleted. Remove them
          first, or untick “Show on the public site” to take the whole
          collection off the site without losing the captions and the order.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 border-t border-ink-200 pt-6">
      {state.status === 'error' && state.message && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      <form action={formAction}>
        <input type="hidden" name="collectionId" value={collectionId} />
        <SubmitButton variant="ghost" size="sm" pendingLabel="Deleting…">
          Delete this empty collection
        </SubmitButton>
      </form>
    </div>
  )
}
