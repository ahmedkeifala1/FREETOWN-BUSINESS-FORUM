import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleForm } from '@/components/site/article-form'
import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { ContentStatus } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { Permission, requirePermission, userHas } from '@/lib/rbac'

/**
 * Write or edit one article (§4.13, FR-02).
 *
 * The same route serves both: `/admin/articles/new` is the empty form, and any
 * other id loads that article. One form component, so the two can never drift
 * into disagreeing about what a valid article is.
 */

export const metadata: Metadata = {
  title: 'Article',
}

export default async function AdminArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requirePermission(Permission.CONTENT_EDIT, {
    redirectTo: '/admin/articles',
  })

  const { id } = await params
  const isNew = id === 'new'

  const [article, categories] = await Promise.all([
    isNew
      ? null
      : db.article.findUnique({
          where: { id },
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            body: true,
            heroImageUrl: true,
            categoryId: true,
            status: true,
            isFeatured: true,
            metaTitle: true,
            metaDescription: true,
            publishedAt: true,
            updatedAt: true,
          },
        }),
    db.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  if (!isNew && !article) notFound()

  const canPublish = userHas(user, Permission.CONTENT_PUBLISH)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/articles"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          All articles
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {isNew ? 'Write an article' : article!.title}
          </h1>
          {article && (
            <p className="mt-2 text-sm text-ink-600">
              Last saved {formatDate(article.updatedAt)}
              {article.publishedAt &&
                ` · published ${formatDate(article.publishedAt)}`}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {article && <StatusBadge status={article.status} />}
          {article?.status === ContentStatus.PUBLISHED && (
            <Link
              href={`/blog/${article.slug}`}
              className="text-sm font-medium text-forest-700 hover:underline"
            >
              View live
            </Link>
          )}
        </div>
      </header>

      <Card>
        <ArticleForm
          categories={categories}
          canPublish={canPublish}
          defaults={
            article
              ? {
                  id: article.id,
                  title: article.title,
                  slug: article.slug,
                  excerpt: article.excerpt,
                  body: article.body,
                  heroImageUrl: article.heroImageUrl,
                  categoryId: article.categoryId,
                  status: article.status,
                  isFeatured: article.isFeatured,
                  metaTitle: article.metaTitle,
                  metaDescription: article.metaDescription,
                }
              : null
          }
        />
      </Card>
    </div>
  )
}
