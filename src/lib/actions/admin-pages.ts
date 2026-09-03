'use server'

import { revalidatePath } from 'next/cache'

import { AuditAction, record } from '@/lib/audit'
import { blockField, findCmsPage, type CmsBlock } from '@/lib/cms-pages'
import { db } from '@/lib/db'
import { ContentStatus } from '@/lib/enums'
import { assertPermission, Permission } from '@/lib/rbac'
import { contentStatusSchema, parseForm, pageSchema } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Editing the CMS page bodies (§15, FR-01).
 *
 * The copy on the public site's static pages lives in `Page.bodyJson` so the
 * secretariat can change it without a deploy. This is the screen behind that
 * promise, which until now had no screen at all.
 *
 * The block set comes from `lib/cms-pages`, never from the submitted form. A
 * form that decided its own keys would let anything with a browser write copy
 * under a name no route reads — invisible on the site and impossible to
 * diagnose — and would equally let a renamed field silently drop a block that
 * was live a minute ago. So the manifest is read first, and exactly the keys it
 * declares are pulled out of the form and written back.
 *
 * The same reasoning applies to the slug: it is how a route finds its copy, so
 * it is taken from the manifest and never from the form. Renaming it is not a
 * CMS operation, it is a code change in the route that reads it.
 *
 * Publishing is a separate permission from editing, exactly as it is for
 * articles (§12) — an editor may draft, and only CONTENT_PUBLISH may put a page
 * live. `pageSchema` covers the fields the page owns; the blocks are validated
 * here because their shape is per-page and the schema cannot know it.
 */

/** One item of a `list` block once it has been read out of the form. */
type ListItem = Record<string, string>

/**
 * Read a `list` block's JSON, drop the blank rows, and keep only the declared
 * fields.
 *
 * The editor posts these as JSON because the rows are added and removed in the
 * browser, so their number is not known when the form is rendered. It is still
 * treated as untrusted input: anything that is not an array of objects is a
 * validation error rather than something to coerce, and an unknown field is
 * dropped rather than stored, so a stale browser tab cannot smuggle a key into
 * the body.
 *
 * An item is "blank" when every required field on it is empty, which is what a
 * row the editor added and then left alone looks like. Those are discarded
 * silently — pressing "add" and changing your mind is not an error worth a
 * message. An item that is *partly* filled is one, because dropping it would
 * throw away typing the writer can see on their screen.
 */
function readListBlock(
  block: Extract<CmsBlock, { kind: 'list' }>,
  raw: string,
): { ok: true; items: ListItem[] } | { ok: false; error: string } {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw || '[]')
  } catch {
    return { ok: false, error: 'That section could not be read. Reload and try again.' }
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'That section could not be read. Reload and try again.' }
  }

  const items: ListItem[] = []

  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return {
        ok: false,
        error: 'That section could not be read. Reload and try again.',
      }
    }

    const source = entry as Record<string, unknown>
    const item: ListItem = {}

    for (const field of block.fields) {
      const value = source[field.name]
      item[field.name] = typeof value === 'string' ? value.trim() : ''
    }

    const required = block.fields.filter((field) => !field.optional)
    const allBlank = required.every((field) => !item[field.name])
    if (allBlank) continue

    const missing = required.find((field) => !item[field.name])
    if (missing) {
      return {
        ok: false,
        error: `Every ${block.itemNoun} needs a ${missing.label.toLowerCase()}.`,
      }
    }

    items.push(item)
  }

  return { ok: true, items }
}

export async function savePage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.CONTENT_EDIT)
  } catch (error) {
    return errorState((error as Error).message)
  }

  // The manifest, not the form, decides which page this is and what it holds.
  const page = findCmsPage(String(formData.get('pageSlug') ?? ''))
  if (!page) return errorState('That page is not one the editor manages.')

  const parsed = parseForm(
    pageSchema.pick({ title: true, metaTitle: true, metaDescription: true }),
    formData,
  )
  if (!parsed.ok) return fieldErrors(parsed.errors)

  const status = contentStatusSchema.safeParse(formData.get('status'))
  if (!status.success) {
    return fieldErrors({ status: 'Choose a valid status.' })
  }

  // Publishing is its own permission — see the note at the top.
  if (status.data === ContentStatus.PUBLISHED) {
    try {
      await assertPermission(Permission.CONTENT_PUBLISH)
    } catch {
      return fieldErrors({
        status: 'You can save this as a draft, but not publish it.',
      })
    }
  }

  const body: Record<string, string> = {}
  const blockErrors: Record<string, string> = {}

  for (const block of page.blocks) {
    const raw = String(formData.get(blockField(block.key)) ?? '')

    // Prose, single lines and image addresses are all one trimmed string on the
    // way in; what separates them is the control the editor shows and the
    // length the route expects, neither of which is this loop's business.
    if (
      block.kind === 'prose' ||
      block.kind === 'line' ||
      block.kind === 'image'
    ) {
      const trimmed = raw.trim()

      // A heading pasted as a paragraph would set a wall of text at display
      // size. The cap is generous — it is a guard against a paste, not a style
      // rule — and the message says what to do rather than only what is wrong.
      if (block.kind === 'line') {
        const max = block.max ?? 200
        if (trimmed.length > max) {
          blockErrors[blockField(block.key)] =
            `That is one line on the page — keep it under ${max} characters.`
          continue
        }
      }

      // An empty block is omitted rather than stored as "". The routes test
      // for the key's presence to decide whether to render the section at all,
      // so an empty string would print a heading over nothing.
      if (trimmed) body[block.key] = trimmed
      continue
    }

    const list = readListBlock(block, raw)
    if (!list.ok) {
      blockErrors[blockField(block.key)] = list.error
      continue
    }
    if (list.items.length > 0) {
      body[block.key] = JSON.stringify(list.items)
    }
  }

  if (Object.keys(blockErrors).length > 0) return fieldErrors(blockErrors)

  const existing = await db.page.findUnique({
    where: { slug: page.slug },
    select: { id: true, status: true },
  })

  const values = {
    title: parsed.data.title,
    bodyJson: JSON.stringify(body),
    metaTitle: parsed.data.metaTitle || null,
    metaDescription: parsed.data.metaDescription || null,
    status: status.data,
    updatedById: staff.id,
  }

  let saved: { id: string }

  try {
    saved = await db.page.upsert({
      where: { slug: page.slug },
      update: values,
      create: { ...values, slug: page.slug },
      select: { id: true },
    })
  } catch {
    return errorState(
      'We could not save the page just now. Please try again shortly.',
    )
  }

  // Page copy is published material, so a change to it is recorded the way an
  // article is. Every save is logged, not only a status change: unlike an
  // article, this screen rewrites live public copy in place, and "who changed
  // the refunds clause in March" is the question the trail exists to answer.
  await record({
    userId: staff.id,
    action: AuditAction.CONTENT_PUBLISH,
    entityType: 'Page',
    entityId: saved.id,
    summary: `${existing ? 'Updated' : 'Created'} page "${values.title}" — status ${status.data}.`,
    metadata: {
      slug: page.slug,
      status: status.data,
      blocks: Object.keys(body),
    },
  })

  revalidatePath('/admin/pages')
  for (const route of page.routes) revalidatePath(route)

  return successState(
    status.data === ContentStatus.PUBLISHED
      ? 'Saved and live.'
      : 'Saved as a draft. This page is not public.',
  )
}
