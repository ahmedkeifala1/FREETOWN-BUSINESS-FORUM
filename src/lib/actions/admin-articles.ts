'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { AuditAction, record } from '@/lib/audit'
import { db } from '@/lib/db'
import { ContentStatus } from '@/lib/enums'
import { assertPermission, Permission } from '@/lib/rbac'
import { articleSchema, parseForm } from '@/lib/validation'
import {
  errorState,
  fieldErrors,
  successState,
  type FormState,
} from '@/lib/actions/types'

/**
 * Writing and publishing articles (FR-01, FR-02, §4.13).
 *
 * Publishing is a separate permission from editing (§12), so an editor can
 * draft and an editor with CONTENT_PUBLISH can push live. The check is made
 * against the status being *written*, not against the form being submitted —
 * saving a draft needs only CONTENT_EDIT even for someone who could publish.
 *
 * `publishedAt` is stamped once, the first time an article goes live, and never
 * moved by a later edit. It is the date on the article, and a typo corrected in
 * March should not republish a January piece to the top of the list.
 */

/** A slug that is free, ignoring the article that already holds it. */
async function slugIsFree(slug: string, exceptId?: string): Promise<boolean> {
  const clash = await db.article.findUnique({
    where: { slug },
    select: { id: true },
  })
  return !clash || clash.id === exceptId
}

export async function saveArticle(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  let staff
  try {
    staff = await assertPermission(Permission.CONTENT_EDIT)
  } catch (error) {
    return errorState((error as Error).message)
  }

  const parsed = parseForm(articleSchema, formData)

  if (!parsed.ok) return fieldErrors(parsed.errors)

  const data = parsed.data
  const articleId = String(formData.get('articleId') ?? '') || null

  if (!(await slugIsFree(data.slug, articleId ?? undefined))) {
    return fieldErrors({
      slug: 'Another article already uses that web address.',
    })
  }

  // Publishing is its own permission — see the note at the top.
  if (data.status === ContentStatus.PUBLISHED) {
    try {
      await assertPermission(Permission.CONTENT_PUBLISH)
    } catch {
      return fieldErrors({
        status: 'You can save this as a draft, but not publish it.',
      })
    }
  }

  const existing = articleId
    ? await db.article.findUnique({
        where: { id: articleId },
        select: { id: true, slug: true, status: true, publishedAt: true },
      })
    : null

  if (articleId && !existing) {
    return errorState('That article no longer exists.')
  }

  const goingLive =
    data.status === ContentStatus.PUBLISHED && !existing?.publishedAt

  const values = {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    body: data.body,
    heroImageUrl: data.heroImageUrl || null,
    categoryId: data.categoryId || null,
    status: data.status,
    isFeatured: data.isFeatured,
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    // Stamped once, on the way live, and never moved afterwards.
    ...(goingLive ? { publishedAt: new Date() } : {}),
  }

  let saved: { id: string; slug: string }

  try {
    saved = existing
      ? await db.article.update({
          where: { id: existing.id },
          data: values,
          select: { id: true, slug: true },
        })
      : await db.article.create({
          data: { ...values, authorId: staff.id },
          select: { id: true, slug: true },
        })
  } catch {
    return errorState(
      'We could not save the article just now. Please try again shortly.',
    )
  }

  if (goingLive || existing?.status !== data.status) {
    await record({
      userId: staff.id,
      action: AuditAction.CONTENT_PUBLISH,
      entityType: 'Article',
      entityId: saved.id,
      summary: `${existing ? 'Updated' : 'Created'} article "${data.title}" — status ${data.status}.`,
      metadata: { slug: saved.slug, status: data.status },
    })
  }

  revalidatePath('/admin/articles')
  revalidatePath('/blog')
  revalidatePath(`/blog/${saved.slug}`)
  if (existing && existing.slug !== saved.slug) {
    revalidatePath(`/blog/${existing.slug}`)
  }

  // A new article gets its own address so a refresh does not create a second.
  if (!existing) redirect(`/admin/articles/${saved.id}`)

  return successState(
    data.status === ContentStatus.PUBLISHED
      ? 'Saved and live.'
      : 'Saved as a draft.',
  )
}
