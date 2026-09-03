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
import { UploadField } from '@/components/ui/upload'
import { saveArticle } from '@/lib/actions/admin-articles'
import { idleState } from '@/lib/actions/types'
import { ContentStatus } from '@/lib/enums'

/**
 * Writing an article (§4.13, FR-02).
 *
 * The body is a plain textarea rather than a rich-text editor. Every article
 * this forum publishes is prose with paragraphs and the occasional link, a
 * WYSIWYG field is the usual source of pasted Word markup, and the render side
 * already treats the body as text with paragraph breaks. If galleries and
 * embeds are wanted later, that is a considered change to both ends, not a
 * component swap.
 *
 * "Publish" is offered to everyone and refused server-side for a role without
 * the permission — the refusal comes back as a field error on the status. That
 * is deliberate: an editor who cannot publish should learn why, not silently
 * find the option missing.
 */

export type ArticleDefaults = {
  id: string
  title: string
  slug: string
  excerpt: string
  body: string
  heroImageUrl: string | null
  categoryId: string | null
  status: string
  isFeatured: boolean
  metaTitle: string | null
  metaDescription: string | null
}

export function ArticleForm({
  defaults,
  categories,
  canPublish,
  uploadsEnabled,
}: {
  defaults: ArticleDefaults | null
  categories: { id: string; name: string }[]
  canPublish: boolean
  /** Whether a blob store is attached — see lib/uploads. Decided on the server. */
  uploadsEnabled: boolean
}) {
  const [state, formAction] = useActionState(saveArticle, idleState)

  const errors = state.status === 'error' ? state.errors : undefined

  return (
    <form action={formAction} className="space-y-8">
      {defaults && (
        <input type="hidden" name="articleId" value={defaults.id} />
      )}

      <ErrorSummary errors={errors} />

      {state.status === 'success' && (
        <FormMessage status="success">{state.message}</FormMessage>
      )}

      {state.status === 'error' && state.message && !errors && (
        <FormMessage status="error">{state.message}</FormMessage>
      )}

      {/* ── The piece ────────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          The piece
        </legend>

        <Field label="Headline" name="title" error={errors?.title} required>
          <Input
            name="title"
            defaultValue={defaults?.title ?? ''}
            required
            error={errors?.title}
          />
        </Field>

        <Field
          label="Web address"
          name="slug"
          hint="Lower case, words separated by hyphens. Changing it on a published article breaks existing links."
          error={errors?.slug}
          required
        >
          <Input
            name="slug"
            defaultValue={defaults?.slug ?? ''}
            required
            error={errors?.slug}
          />
        </Field>

        <Field
          label="Standfirst"
          name="excerpt"
          hint="The sentence or two under the headline, and what appears on the article card."
          error={errors?.excerpt}
          required
        >
          <Textarea
            name="excerpt"
            rows={3}
            maxLength={500}
            defaultValue={defaults?.excerpt ?? ''}
            required
            error={errors?.excerpt}
          />
        </Field>

        <Field label="Body" name="body" error={errors?.body} required>
          <Textarea
            name="body"
            rows={20}
            defaultValue={defaults?.body ?? ''}
            required
            error={errors?.body}
            className="font-mono text-sm"
          />
        </Field>
      </fieldset>

      {/* ── Presentation ─────────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          Presentation
        </legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" name="categoryId" error={errors?.categoryId}>
            <Select
              name="categoryId"
              defaultValue={defaults?.categoryId ?? ''}
              error={errors?.categoryId}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Hero image"
            name="heroImageUrl"
            error={errors?.heroImageUrl}
          >
            <UploadField
              name="heroImageUrl"
              kind="image"
              enabled={uploadsEnabled}
              placeholder="https://"
              defaultValue={defaults?.heroImageUrl ?? ''}
              error={errors?.heroImageUrl}
            />
          </Field>
        </div>

        <Checkbox
          name="isFeatured"
          defaultChecked={defaults?.isFeatured}
          label="Feature this article on the homepage"
        />
      </fieldset>

      {/* ── Search engines ───────────────────────────────────────────────── */}

      <fieldset className="space-y-5">
        <legend className="font-display text-base font-semibold text-ink-950">
          Search engines
        </legend>
        <p className="text-sm text-ink-600">
          Leave both blank to use the headline and standfirst.
        </p>

        <Field label="Meta title" name="metaTitle" error={errors?.metaTitle}>
          <Input
            name="metaTitle"
            maxLength={200}
            defaultValue={defaults?.metaTitle ?? ''}
            error={errors?.metaTitle}
          />
        </Field>

        <Field
          label="Meta description"
          name="metaDescription"
          error={errors?.metaDescription}
        >
          <Textarea
            name="metaDescription"
            rows={2}
            maxLength={300}
            defaultValue={defaults?.metaDescription ?? ''}
            error={errors?.metaDescription}
          />
        </Field>
      </fieldset>

      {/* ── Status ───────────────────────────────────────────────────────── */}

      <div className="space-y-5 border-t border-ink-200 pt-6">
        <Field label="Status" name="status" error={errors?.status} required>
          <Select
            name="status"
            defaultValue={defaults?.status ?? ContentStatus.DRAFT}
            error={errors?.status}
          >
            <option value={ContentStatus.DRAFT}>Draft — not public</option>
            <option value={ContentStatus.PUBLISHED}>Published — live</option>
            <option value={ContentStatus.ARCHIVED}>
              Archived — taken down
            </option>
          </Select>
        </Field>

        {!canPublish && (
          <p className="text-sm text-ink-600">
            Your role can write and edit but not publish. Save it as a draft and
            ask an editor with publishing rights to put it live.
          </p>
        )}

        <SubmitButton size="md" pendingLabel="Saving…">
          {defaults ? 'Save changes' : 'Create article'}
        </SubmitButton>
      </div>
    </form>
  )
}
