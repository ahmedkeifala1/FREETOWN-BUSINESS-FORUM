import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, LinkCard } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  CtaBand,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { db } from '@/lib/db'
import { ContentStatus } from '@/lib/enums'
import {
  formatDate,
  isoDate,
  paragraphs,
  truncate,
} from '@/lib/format'
import { getPageCopy } from '@/lib/settings'

/**
 * An article (SDR §4.13: "title, hero image, author, date, body, share
 * buttons, related posts").
 *
 * The body is stored as plain text with blank lines between paragraphs, so it
 * is split and rendered as elements rather than injected as HTML. That is not
 * a limitation being worked around — it is what makes an editor's article
 * unable to carry a script tag into the page (NFR-05, XSS). When the CMS grows
 * rich text, it will need sanitising on the way in, not `dangerouslySetInnerHTML`
 * on the way out.
 *
 * Sharing is done with links, not a widget: a share button that loads a
 * third-party script costs more than the share is worth on a 3G connection,
 * and the two that matter here — WhatsApp and email — are plain URLs.
 */

type Params = { slug: string }

async function getArticle(slug: string) {
  return db.article.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED },
    include: {
      category: { select: { slug: true, name: true } },
      author: { select: { firstName: true, lastName: true } },
      tags: { select: { slug: true, name: true } },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)

  if (!article) return { title: 'Article not found' }

  return {
    title: article.metaTitle ?? article.title,
    description: article.metaDescription ?? truncate(article.excerpt, 200),
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description: truncate(article.excerpt, 200),
      publishedTime: article.publishedAt
        ? isoDate(article.publishedAt)
        : undefined,
      images: article.heroImageUrl ? [article.heroImageUrl] : undefined,
    },
  }
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params
  const [article, copy] = await Promise.all([
    getArticle(slug),
    getPageCopy('blog'),
  ])

  if (!article) notFound()

  const related = await db.article.findMany({
    where: {
      status: ContentStatus.PUBLISHED,
      NOT: { id: article.id },
      // Prefer the same category; the fallback below fills the gap when the
      // category is thin, so a new category never shows an empty rail.
      ...(article.categoryId ? { categoryId: article.categoryId } : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      category: { select: { name: true } },
    },
  })

  const fallback =
    related.length === 0
      ? await db.article.findMany({
          where: { status: ContentStatus.PUBLISHED, NOT: { id: article.id } },
          orderBy: { publishedAt: 'desc' },
          take: 3,
          select: {
            id: true,
            slug: true,
            title: true,
            excerpt: true,
            publishedAt: true,
            category: { select: { name: true } },
          },
        })
      : []

  const others = related.length > 0 ? related : fallback

  const author = article.author
    ? `${article.author.firstName} ${article.author.lastName}`
    : null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fbf.sl'
  const shareUrl = `${siteUrl}/blog/${article.slug}`

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Blog', href: '/blog' },
          { label: article.title, href: `/blog/${article.slug}` },
        ]}
      />

      <article>
        <Section tone="white" size="narrow" className="pb-0">
          {article.category && (
            <Link
              href={`/blog?category=${article.category.slug}`}
              className="text-sm font-semibold uppercase tracking-wider text-forest-700 hover:underline"
            >
              {article.category.name}
            </Link>
          )}

          <h1 className="mt-4 text-3xl leading-tight text-ink-950 sm:text-4xl lg:text-5xl">
            {article.title}
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-ink-700">
            {article.excerpt}
          </p>

          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
            {article.publishedAt && (
              <time dateTime={isoDate(article.publishedAt)}>
                {formatDate(article.publishedAt)}
              </time>
            )}
            {author && (
              <>
                <span aria-hidden="true">·</span>
                <span>By {author}</span>
              </>
            )}
          </p>
        </Section>

        {article.heroImageUrl && (
          <Container size="narrow" className="mt-10">
            {/* Remote CMS URL — see the note in ui/card.tsx. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.heroImageUrl}
              alt=""
              className="aspect-16/9 w-full bg-ink-100 object-cover"
            />
          </Container>
        )}

        <Section tone="white" size="narrow">
          <div className="prose-slbf">
            {paragraphs(article.body).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {article.tags.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2 border-t border-ink-200 pt-8">
              {article.tags.map((tag) => (
                <li key={tag.slug}>
                  <Badge tone="neutral">{tag.name}</Badge>
                </li>
              ))}
            </ul>
          )}

          {/* ── Share ───────────────────────────────────────────────────── */}

          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink-200 pt-8">
            <span className="text-sm font-semibold uppercase tracking-wider text-ink-500">
              Share
            </span>

            <ShareLink
              label="WhatsApp"
              href={`https://wa.me/?text=${encodeURIComponent(
                `${article.title} — ${shareUrl}`,
              )}`}
            />
            <ShareLink
              label="LinkedIn"
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                shareUrl,
              )}`}
            />
            <ShareLink
              label="Email"
              href={`mailto:?subject=${encodeURIComponent(
                article.title,
              )}&body=${encodeURIComponent(shareUrl)}`}
              external={false}
            />
          </div>
        </Section>
      </article>

      {others.length > 0 && (
        <Section tone="muted" size="wide">
          <SectionHeading
            eyebrow={copy('articleMoreEyebrow', 'Keep reading')}
            title={copy('articleMoreTitle', 'More from the forum')}
          />

          <CardGrid columns={3} className="mt-10">
            {others.map((other) => (
              <LinkCard
                key={other.id}
                href={`/blog/${other.slug}`}
                className="h-full"
              >
                {other.category && (
                  <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                    {other.category.name}
                  </p>
                )}

                <h3 className="mt-2 font-display text-base font-semibold leading-snug text-ink-950 group-hover:text-forest-700">
                  {other.title}
                </h3>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {truncate(other.excerpt, 120)}
                </p>

                {other.publishedAt && (
                  <p className="mt-4 text-xs text-ink-500">
                    <time dateTime={isoDate(other.publishedAt)}>
                      {formatDate(other.publishedAt)}
                    </time>
                  </p>
                )}
              </LinkCard>
            ))}
          </CardGrid>
        </Section>
      )}

      <CtaBand
        title={copy('articleCtaTitle', 'Get this by email')}
        lead={copy(
          'articleCtaLead',
          'The monthly briefing carries the investment and policy news that does not make it onto the blog.',
        )}
      >
        <ButtonLink
          href="/membership"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Join the forum
        </ButtonLink>
        <ButtonLink
          href="/blog"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          All articles
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function ShareLink({
  label,
  href,
  external = true,
}: {
  label: string
  href: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
    >
      <Icon name={label === 'Email' ? 'mail' : 'globe'} className="size-4" />
      {label}
      {external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  )
}
