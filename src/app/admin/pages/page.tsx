import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { db } from '@/lib/db'
import { CMS_PAGES } from '@/lib/cms-pages'
import { formatDate } from '@/lib/format'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * The CMS pages (§15, FR-01).
 *
 * Listed from the manifest rather than from the table, because a page the
 * secretariat has never saved has no row yet and is exactly the one most worth
 * showing. `governance` and `sponsorship` have been rendering the fallback copy
 * written into their route files since launch; a list built from `db.page`
 * would leave them invisible and that copy uneditable for good.
 *
 * There is no "new page" button and no delete. A page exists because a route
 * reads it, so both operations are code changes — see the note in
 * `lib/cms-pages`.
 */

export const metadata: Metadata = {
  title: 'Pages',
}

export default async function AdminPagesPage() {
  await requirePermission(Permission.CONTENT_EDIT, {
    redirectTo: '/admin/pages',
  })

  const rows = await db.page.findMany({
    where: { slug: { in: CMS_PAGES.map((page) => page.slug) } },
    select: {
      slug: true,
      title: true,
      status: true,
      updatedAt: true,
      updatedBy: { select: { firstName: true, lastName: true } },
    },
  })

  const bySlug = new Map(rows.map((row) => [row.slug, row]))

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">Pages</h1>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">
          The wording on every public page &mdash; headings, standfirsts, button
          labels and the messages shown when a list is empty. Each section you
          leave blank keeps the wording built into the page, so nothing here can
          empty a page by accident.
        </p>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-600">
          Photographs and film are not here: they live in{' '}
          <Link
            href="/admin/media"
            className="font-medium text-forest-700 hover:underline"
          >
            Media
          </Link>
          , which is where the homepage picture wall is changed. Contact
          details, the hero wording and the newsletter blurb are in{' '}
          <Link
            href="/admin/settings"
            className="font-medium text-forest-700 hover:underline"
          >
            Settings
          </Link>
          .
        </p>
      </header>

      <Card padded={false}>
        <ul className="divide-y divide-ink-100">
          {CMS_PAGES.map((page) => {
            const row = bySlug.get(page.slug)

            return (
              <li key={page.slug}>
                <Link
                  href={`/admin/pages/${page.slug}`}
                  className="block px-5 py-4 transition-colors hover:bg-ink-50 sm:px-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-950">
                        {row?.title ?? page.defaultTitle}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-600">
                        {page.description}
                      </p>
                      <p className="mt-1 text-sm text-ink-500">
                        {page.routes.join(' · ')}
                        {row
                          ? ` · Updated ${formatDate(row.updatedAt)}`
                          : ' · Never edited'}
                        {row?.updatedBy &&
                          ` by ${row.updatedBy.firstName} ${row.updatedBy.lastName}`}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {row ? (
                        <StatusBadge status={row.status} />
                      ) : (
                        <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
                          Not written
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
