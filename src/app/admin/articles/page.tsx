import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { formatDate } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * Articles (§4.13, FR-02).
 *
 * Drafts first, then published by date. A drafts-last list is a list where the
 * unfinished work is invisible, and unfinished work is the only thing on this
 * screen that needs doing.
 */

export const metadata: Metadata = {
  title: 'Articles',
}

export default async function AdminArticlesPage() {
  await requirePermission(Permission.CONTENT_EDIT, {
    redirectTo: '/admin/articles',
  })

  const articles = await db.article.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      status: true,
      isFeatured: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      author: { select: { firstName: true, lastName: true } },
    },
  })

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            Articles
          </h1>
          <p className="mt-2 leading-relaxed text-ink-600">
            News and insight for the public site. Nothing is live until it is
            published.
          </p>
        </div>

        <ButtonLink href="/admin/articles/new" size="md">
          Write an article
        </ButtonLink>
      </header>

      {articles.length === 0 ? (
        <EmptyState
          title="Nothing written yet"
          message="Articles you write appear here, drafts first."
        >
          <ButtonLink href="/admin/articles/new" size="md">
            Write the first one
          </ButtonLink>
        </EmptyState>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-ink-100">
            {articles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/admin/articles/${article.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-950">
                        {article.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-600">
                        {article.excerpt}
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        {article.category?.name && `${article.category.name} · `}
                        {article.publishedAt
                          ? `Published ${formatDate(article.publishedAt)}`
                          : `Started ${formatDate(article.createdAt)}`}
                        {article.author &&
                          ` · ${article.author.firstName} ${article.author.lastName}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {article.isFeatured && (
                        <span className="text-xs font-medium uppercase tracking-wider text-gold-700">
                          Featured
                        </span>
                      )}
                      <StatusBadge status={article.status} />
                    </div>
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
