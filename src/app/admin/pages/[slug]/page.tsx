import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PageForm } from '@/components/site/page-form'
import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { findCmsPage } from '@/lib/cms-pages'
import { db } from '@/lib/db'
import { ContentStatus } from '@/lib/enums'
import { formatDate, parseJsonColumn } from '@/lib/format'
import { Permission, requirePermission, userHas } from '@/lib/rbac'
import { uploadsEnabled } from '@/lib/uploads'

/**
 * Edit one CMS page (§15).
 *
 * Addressed by slug rather than by id, because the row may not exist yet:
 * `governance` and `sponsorship` are real pages on the public site that have
 * never been written, and an id-based route could not offer them at all. The
 * slug comes from the manifest, so an unknown one is a 404 rather than an
 * invitation to create a page nothing reads.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = findCmsPage(slug)

  return { title: page ? page.defaultTitle : 'Page' }
}

export default async function AdminPageEditor({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await requirePermission(Permission.CONTENT_EDIT, {
    redirectTo: '/admin/pages',
  })

  const { slug } = await params
  const page = findCmsPage(slug)

  if (!page) notFound()

  const row = await db.page.findUnique({
    where: { slug: page.slug },
    select: {
      title: true,
      bodyJson: true,
      metaTitle: true,
      metaDescription: true,
      status: true,
      updatedAt: true,
      updatedBy: { select: { firstName: true, lastName: true } },
    },
  })

  const blocks = parseJsonColumn<Record<string, string>>(row?.bodyJson ?? null, {})

  const canPublish = userHas(user, Permission.CONTENT_PUBLISH)

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link
          href="/admin/pages"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-950"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          All pages
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-950">
              {row?.title ?? page.defaultTitle}
            </h1>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-600">
              {page.description}
            </p>
          </div>

          {row ? (
            <StatusBadge status={row.status} />
          ) : (
            <span className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Not written
            </span>
          )}
        </div>

        <p className="text-sm text-ink-500">
          {row?.updatedAt ? (
            <>
              Last updated {formatDate(row.updatedAt)}
              {row.updatedBy &&
                ` by ${row.updatedBy.firstName} ${row.updatedBy.lastName}`}
            </>
          ) : (
            'Never edited — the pages below are showing the wording built into them.'
          )}
        </p>

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {page.routes.map((route) => (
            <Link
              key={route}
              href={route}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-forest-700 transition-colors hover:text-forest-800"
            >
              View {route}
              <Icon name="arrowRight" className="size-4" />
            </Link>
          ))}
        </p>
      </header>

      <Card>
        <PageForm
          slug={page.slug}
          blocks={page.blocks}
          canPublish={canPublish}
          uploadsEnabled={uploadsEnabled()}
          defaults={{
            title: row?.title ?? page.defaultTitle,
            metaTitle: row?.metaTitle ?? null,
            metaDescription: row?.metaDescription ?? null,
            /*
              A page nobody has saved yet opens ready to publish, for anyone
              who is allowed to.

              It used to open as a draft, on the reasoning that saving a page
              to see how it reads should not put half-finished copy on the
              site. That was written when two pages lacked a row and their
              blocks were the whole body. It is now the wrong default: most
              pages in the manifest are *overrides* — a blank block falls back
              to the wording in the route file — so publishing one changes
              nothing until somebody writes something, while leaving it a
              draft means an editor's first save silently does nothing at all.
              Fifteen pages have no row, so that silence would be the normal
              first experience of this screen rather than an edge case.

              Someone who cannot publish still opens on a draft, because that
              is the only status they are allowed to save.
            */
            status:
              row?.status ??
              (canPublish ? ContentStatus.PUBLISHED : ContentStatus.DRAFT),
            /* Drives the notice on a page that has never been saved. */
            isNew: !row,
            blocks,
          }}
        />
      </Card>
    </div>
  )
}
