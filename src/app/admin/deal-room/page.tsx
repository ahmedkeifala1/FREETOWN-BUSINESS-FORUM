import Link from 'next/link'
import type { Metadata } from 'next'

import { DecisionForm } from '@/components/site/decision-form'
import { StatusBadge } from '@/components/site/status-badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import {
  decideAccessRequest,
  decideFundingApplication,
} from '@/lib/actions/admin-review'
import { db } from '@/lib/db'
import {
  AccessRequestStatus,
  ApplicationStatus,
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { Permission, requirePermission, userHas } from '@/lib/rbac'

/**
 * The Deal Room queues (§4.12, FR-15, §12).
 *
 * Two lists behind two tabs, because they are two jobs done by the same person
 * at different times: reading a business's proposition, and passing an
 * investor's request to the business behind one. Showing both at once makes
 * neither list feel finishable.
 *
 * Each application is shown in full rather than as a row that opens a page.
 * The decision needs the description and the use of funds, and a queue that
 * demands a round trip per item does not get worked through.
 */

export const metadata: Metadata = {
  title: 'Deal Room',
}

const APPLICATION_OPTIONS = [
  { value: ApplicationStatus.UNDER_REVIEW, label: 'Under review' },
  { value: ApplicationStatus.SHORTLISTED, label: 'Shortlisted' },
  { value: ApplicationStatus.APPROVED, label: 'Approve — take forward' },
  { value: ApplicationStatus.REJECTED, label: 'Reject — not taken forward' },
]

const ACCESS_OPTIONS = [
  { value: AccessRequestStatus.APPROVED, label: 'Approve — release the pack' },
  { value: AccessRequestStatus.DECLINED, label: 'Decline' },
]

export default async function AdminDealRoomPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requirePermission(Permission.DEALROOM_VIEW, {
    redirectTo: '/admin/deal-room',
  })

  const { tab } = await searchParams
  const onAccess = tab === 'access'

  const canManage = userHas(user, Permission.DEALROOM_MANAGE)

  const [applications, requests, openApplications, openRequests] =
    await Promise.all([
      onAccess
        ? []
        : db.fundingApplication.findMany({
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
            take: 100,
            select: {
              id: true,
              reference: true,
              businessName: true,
              contactName: true,
              email: true,
              phone: true,
              region: true,
              stage: true,
              status: true,
              amountRequestedMinor: true,
              currency: true,
              businessDescription: true,
              useOfFunds: true,
              yearsTrading: true,
              employees: true,
              reviewNotes: true,
              createdAt: true,
              sector: { select: { name: true } },
            },
          }),

      onAccess
        ? db.investorAccessRequest.findMany({
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
            take: 100,
            select: {
              id: true,
              investorName: true,
              organisation: true,
              email: true,
              country: true,
              investmentFocus: true,
              ticketSizeMinor: true,
              currency: true,
              message: true,
              status: true,
              createdAt: true,
              opportunity: { select: { title: true, slug: true } },
            },
          })
        : [],

      db.fundingApplication.count({
        where: { status: ApplicationStatus.SUBMITTED },
      }),
      db.investorAccessRequest.count({
        where: { status: AccessRequestStatus.PENDING },
      }),
    ])

  const tabs = [
    {
      label: `Funding applications${openApplications ? ` (${openApplications})` : ''}`,
      href: '/admin/deal-room',
      current: !onAccess,
    },
    {
      label: `Access requests${openRequests ? ` (${openRequests})` : ''}`,
      href: '/admin/deal-room?tab=access',
      current: onAccess,
    },
  ]

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Deal Room
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Propositions from businesses seeking capital, and investors asking to
          see them.
        </p>
      </header>

      <nav aria-label="Deal Room sections">
        <ul className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={item.current ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium transition-colors',
                  item.current
                    ? 'bg-forest-600 text-white'
                    : 'border border-ink-300 bg-white text-ink-700 hover:border-forest-500 hover:text-forest-700',
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Funding applications ────────────────────────────────────────── */}

      {!onAccess &&
        (applications.length === 0 ? (
          <EmptyState
            title="No applications yet"
            message="Propositions submitted through the Deal Room apply form appear here."
          />
        ) : (
          <ul className="space-y-4">
            {applications.map((application) => (
              <li key={application.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-ink-950">
                        {application.businessName}
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-600">
                        <span className="font-mono">
                          {application.reference}
                        </span>
                        {' · '}
                        {formatDate(application.createdAt)}
                        {application.sector && ` · ${application.sector.name}`}
                        {application.region && ` · ${application.region}`}
                      </p>
                    </div>

                    <StatusBadge status={application.status} />
                  </div>

                  <dl className="mt-5 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-500">
                        Seeking
                      </dt>
                      <dd className="mt-0.5 font-display text-lg font-bold text-forest-700">
                        {isCurrency(application.currency)
                          ? formatMoney(
                              application.amountRequestedMinor,
                              application.currency,
                              { compact: true },
                            )
                          : application.amountRequestedMinor}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-500">
                        Stage
                      </dt>
                      <dd className="mt-0.5 text-sm text-ink-900">
                        {OPPORTUNITY_STAGE_LABELS[
                          application.stage as OpportunityStage
                        ] ?? application.stage}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-500">
                        Trading
                      </dt>
                      <dd className="mt-0.5 text-sm text-ink-900">
                        {application.yearsTrading
                          ? `${application.yearsTrading} years`
                          : '—'}
                        {application.employees
                          ? ` · ${application.employees} staff`
                          : ''}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-5 space-y-4 border-t border-ink-100 pt-5">
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-ink-500">
                        The business
                      </h3>
                      <p className="mt-1 whitespace-pre-line leading-relaxed text-ink-700">
                        {application.businessDescription}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-ink-500">
                        Use of funds
                      </h3>
                      <p className="mt-1 whitespace-pre-line leading-relaxed text-ink-700">
                        {application.useOfFunds}
                      </p>
                    </div>
                  </div>

                  <p className="mt-5 border-t border-ink-100 pt-5 text-sm text-ink-600">
                    {application.contactName} —{' '}
                    <a
                      href={`mailto:${application.email}`}
                      className="text-forest-700 hover:underline"
                    >
                      {application.email}
                    </a>
                    {' · '}
                    {application.phone}
                  </p>

                  {application.reviewNotes && (
                    <p className="mt-4 rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-700">
                      <span className="font-medium">Review notes: </span>
                      {application.reviewNotes}
                    </p>
                  )}

                  {canManage && (
                    <div className="mt-6 border-t border-ink-100 pt-6">
                      <DecisionForm
                        action={decideFundingApplication}
                        idField="applicationId"
                        idValue={application.id}
                        options={APPLICATION_OPTIONS}
                        withNotes
                        notesLabel="Review notes"
                        notesHint="Internal — not sent to the applicant."
                      />
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ))}

      {/* ── Access requests ─────────────────────────────────────────────── */}

      {onAccess &&
        (requests.length === 0 ? (
          <EmptyState
            title="No access requests yet"
            message="When an investor asks to see a published proposition, the request appears here."
          />
        ) : (
          <ul className="space-y-4">
            {requests.map((request) => (
              <li key={request.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-ink-950">
                        {request.investorName}
                        {request.organisation && (
                          <span className="font-normal text-ink-600">
                            {' '}
                            — {request.organisation}
                          </span>
                        )}
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-600">
                        wants{' '}
                        <Link
                          href={`/deal-room/${request.opportunity.slug}`}
                          className="font-medium text-forest-700 hover:underline"
                        >
                          {request.opportunity.title}
                        </Link>
                        {' · '}
                        {formatDate(request.createdAt)}
                      </p>
                    </div>

                    <StatusBadge status={request.status} />
                  </div>

                  <dl className="mt-5 grid gap-4 border-t border-ink-100 pt-5 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-500">
                        Ticket size
                      </dt>
                      <dd className="mt-0.5 text-sm text-ink-900">
                        {request.ticketSizeMinor && isCurrency(request.currency)
                          ? formatMoney(
                              request.ticketSizeMinor,
                              request.currency,
                              { compact: true },
                            )
                          : 'Not given'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-500">
                        Country
                      </dt>
                      <dd className="mt-0.5 text-sm text-ink-900">
                        {request.country ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-ink-500">
                        Contact
                      </dt>
                      <dd className="mt-0.5 text-sm">
                        <a
                          href={`mailto:${request.email}`}
                          className="text-forest-700 hover:underline"
                        >
                          {request.email}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  {request.investmentFocus && (
                    <p className="mt-4 text-sm text-ink-700">
                      <span className="font-medium">Focus: </span>
                      {request.investmentFocus}
                    </p>
                  )}

                  {request.message && (
                    <p className="mt-3 whitespace-pre-line rounded-lg bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-700">
                      {request.message}
                    </p>
                  )}

                  {canManage && (
                    <div className="mt-6 border-t border-ink-100 pt-6">
                      <DecisionForm
                        action={decideAccessRequest}
                        idField="requestId"
                        idValue={request.id}
                        options={ACCESS_OPTIONS}
                        label="Decision"
                      />
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
