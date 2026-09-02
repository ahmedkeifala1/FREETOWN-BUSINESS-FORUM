import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { MemberActions } from '@/components/site/member-actions'
import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { BUSINESS_SIZE_LABELS, type BusinessSize } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { Permission, requirePermission, userHas } from '@/lib/rbac'

/**
 * One membership (FR-09, §12).
 *
 * Everything the secretariat needs to decide whether to activate, on one
 * screen: who applied, what they say they do, and what they have paid. The
 * actions are at the foot rather than the head — the decision comes after
 * reading, and a button above the evidence invites clicking without it.
 *
 * The actions only render for a role that may take them, and they re-check for
 * themselves when submitted (§12).
 */

export const metadata: Metadata = {
  title: 'Member',
}

export default async function AdminMemberPage({
  params,
}: {
  params: Promise<{ memberNo: string }>
}) {
  const user = await requirePermission(Permission.MEMBERSHIP_VIEW, {
    redirectTo: '/admin/members',
  })

  const { memberNo } = await params

  const member = await db.member.findUnique({
    where: { memberNo: decodeURIComponent(memberNo) },
    select: {
      id: true,
      memberNo: true,
      organisationName: true,
      status: true,
      joinedAt: true,
      expiresAt: true,
      createdAt: true,
      tier: {
        select: {
          name: true,
          priceMinor: true,
          currency: true,
          billingPeriodMonths: true,
        },
      },
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          lastLoginAt: true,
        },
      },
      listing: {
        select: {
          slug: true,
          businessName: true,
          shortDescription: true,
          region: true,
          size: true,
          website: true,
          isPublished: true,
          sector: { select: { name: true } },
        },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          status: true,
          amountMinor: true,
          currency: true,
          paidAt: true,
          createdAt: true,
          invoice: { select: { number: true, status: true } },
        },
      },
    },
  })

  if (!member) notFound()

  const canManage = userHas(user, Permission.MEMBERSHIP_MANAGE)

  const fee = isCurrency(member.tier.currency)
    ? formatMoney(member.tier.priceMinor, member.tier.currency)
    : String(member.tier.priceMinor)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/members"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline"
        >
          <Icon name="chevronRight" className="size-4 rotate-180" />
          All members
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950">
            {member.organisationName}
          </h1>
          <p className="mt-2 font-mono text-sm text-ink-700">
            {member.memberNo}
          </p>
        </div>

        <StatusBadge status={member.status} />
      </header>

      {/* ── Membership ──────────────────────────────────────────────────── */}

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Membership
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Tier
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {member.tier.name} — {fee} every{' '}
              {member.tier.billingPeriodMonths} months
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Applied
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {formatDate(member.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Joined
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {member.joinedAt ? formatDate(member.joinedAt) : 'Not yet'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Expires
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {member.expiresAt ? formatDate(member.expiresAt) : '—'}
            </dd>
          </div>
        </dl>
      </Card>

      {/* ── Contact ─────────────────────────────────────────────────────── */}

      <Card>
        <h2 className="font-display text-lg font-semibold text-ink-950">
          Contact
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Name
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {member.user.firstName} {member.user.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Email
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              <a
                href={`mailto:${member.user.email}`}
                className="text-forest-700 hover:underline"
              >
                {member.user.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Phone
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {member.user.phone ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink-500">
              Last signed in
            </dt>
            <dd className="mt-0.5 text-sm text-ink-900">
              {member.user.lastLoginAt
                ? formatDate(member.user.lastLoginAt)
                : 'Never'}
            </dd>
          </div>
        </dl>
      </Card>

      {/* ── What they say they do ───────────────────────────────────────── */}

      {member.listing && (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-display text-lg font-semibold text-ink-950">
              Directory entry
            </h2>
            <StatusBadge
              status={member.listing.isPublished ? 'PUBLISHED' : 'DRAFT'}
            />
          </div>

          <p className="mt-4 leading-relaxed text-ink-700">
            {member.listing.shortDescription}
          </p>

          <dl className="mt-5 grid gap-5 border-t border-ink-100 pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Sector
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {member.listing.sector?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Region
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {member.listing.region ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-500">
                Size
              </dt>
              <dd className="mt-0.5 text-sm text-ink-900">
                {member.listing.size
                  ? (BUSINESS_SIZE_LABELS[
                      member.listing.size as BusinessSize
                    ] ?? member.listing.size)
                  : '—'}
              </dd>
            </div>
          </dl>

          {member.listing.website && (
            <p className="mt-4 text-sm">
              <a
                href={member.listing.website}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-forest-700 hover:underline"
              >
                {member.listing.website}
              </a>
            </p>
          )}

          {member.listing.isPublished && (
            <p className="mt-4 text-sm">
              <Link
                href={`/directory/${member.listing.slug}`}
                className="font-medium text-forest-700 hover:underline"
              >
                View the public entry
              </Link>
            </p>
          )}
        </Card>
      )}

      {/* ── Money ───────────────────────────────────────────────────────── */}

      {userHas(user, Permission.PAYMENT_VIEW) && member.payments.length > 0 && (
        <Card padded={false}>
          <h2 className="px-5 pt-5 font-display text-lg font-semibold text-ink-950 sm:px-6 sm:pt-6">
            Payments
          </h2>

          <ul className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
            {member.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
              >
                <div>
                  <p className="font-medium text-ink-950">
                    {isCurrency(payment.currency)
                      ? formatMoney(payment.amountMinor, payment.currency)
                      : payment.amountMinor}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-600">
                    <span className="font-mono">{payment.reference}</span>
                    {payment.invoice && (
                      <>
                        {' · '}
                        <span className="font-mono">
                          {payment.invoice.number}
                        </span>
                      </>
                    )}
                    {' · '}
                    {payment.paidAt
                      ? `paid ${formatDate(payment.paidAt)}`
                      : `raised ${formatDate(payment.createdAt)}`}
                  </p>
                </div>

                <StatusBadge status={payment.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}

      {canManage && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-ink-950">
            Actions
          </h2>
          <p className="mt-1 text-sm text-ink-600">
            Every action here is written to the audit log against your name.
          </p>

          <div className="mt-6">
            <MemberActions
              memberId={member.id}
              status={member.status}
              organisationName={member.organisationName}
            />
          </div>
        </Card>
      )}
    </div>
  )
}
