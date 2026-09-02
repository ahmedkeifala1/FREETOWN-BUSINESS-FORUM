import Link from 'next/link'
import type { Metadata } from 'next'

import { DecisionForm } from '@/components/site/decision-form'
import { StatusBadge } from '@/components/site/status-badge'
import { Badge, Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { cn } from '@/lib/cn'
import { setSubmissionStatus } from '@/lib/actions/admin-review'
import { db } from '@/lib/db'
import { FORM_TYPE_LABELS, SubmissionStatus, type FormType } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { Permission, requirePermission, userHas } from '@/lib/rbac'

/**
 * Enquiries (§4.15, FR-11, §12).
 *
 * Unread first, then everything else newest-first, because an enquiry nobody
 * has opened is the only kind with somebody waiting. The message is shown in
 * full — an enquiry list that truncates makes staff open every row to find out
 * whether it needs an answer, which is the work the list was meant to save.
 *
 * Replying happens in a mail client, not here. A reply sent from the panel
 * would arrive from a no-reply address and break the thread the enquirer is
 * expecting, so the email address is a mailto link and the status is recorded
 * afterwards.
 */

export const metadata: Metadata = {
  title: 'Enquiries',
}

const FILTERS = [
  { label: 'Unread', value: SubmissionStatus.NEW },
  { label: 'Read', value: SubmissionStatus.READ },
  { label: 'Responded', value: SubmissionStatus.RESPONDED },
  { label: 'Archived', value: SubmissionStatus.ARCHIVED },
  { label: 'All', value: '' },
]

const STATUS_OPTIONS = [
  { value: SubmissionStatus.READ, label: 'Read' },
  { value: SubmissionStatus.RESPONDED, label: 'Responded' },
  { value: SubmissionStatus.ARCHIVED, label: 'Archived' },
  { value: SubmissionStatus.NEW, label: 'Back to unread' },
]

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const user = await requirePermission(Permission.SUBMISSION_VIEW, {
    redirectTo: '/admin/enquiries',
  })

  const { status } = await searchParams

  const active =
    status === undefined
      ? SubmissionStatus.NEW
      : (FILTERS.find((f) => f.value && f.value === status)?.value ?? '')

  const submissions = await db.formSubmission.findMany({
    where: active ? { status: active } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      formType: true,
      name: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
      status: true,
      createdAt: true,
      handledAt: true,
      handledBy: { select: { firstName: true, lastName: true } },
    },
  })

  const canManage = userHas(user, Permission.SUBMISSION_MANAGE)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Enquiries
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Everything sent through the contact and sponsorship forms.
        </p>
      </header>

      <nav aria-label="Filter by status">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const isCurrent = active === filter.value

            return (
              <li key={filter.label}>
                <Link
                  href={`/admin/enquiries?status=${filter.value}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium transition-colors',
                    isCurrent
                      ? 'bg-forest-600 text-white'
                      : 'border border-ink-300 bg-white text-ink-700 hover:border-forest-500 hover:text-forest-700',
                  )}
                >
                  {filter.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {submissions.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message={
            active === SubmissionStatus.NEW
              ? 'Every enquiry has been opened. Nothing is waiting.'
              : 'No enquiry currently has that status.'
          }
        />
      ) : (
        <ul className="space-y-4">
          {submissions.map((submission) => (
            <li key={submission.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold text-ink-950">
                      {submission.subject || submission.name}
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-600">
                      {submission.name} —{' '}
                      <a
                        href={`mailto:${submission.email}${
                          submission.subject
                            ? `?subject=${encodeURIComponent(`Re: ${submission.subject}`)}`
                            : ''
                        }`}
                        className="text-forest-700 hover:underline"
                      >
                        {submission.email}
                      </a>
                      {submission.phone && ` · ${submission.phone}`}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      {formatDate(submission.createdAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge tone="neutral">
                      {FORM_TYPE_LABELS[submission.formType as FormType] ??
                        submission.formType}
                    </Badge>
                    <StatusBadge status={submission.status} />
                  </div>
                </div>

                <p className="mt-5 whitespace-pre-line border-t border-ink-100 pt-5 leading-relaxed text-ink-700">
                  {submission.message}
                </p>

                {submission.handledAt && submission.handledBy && (
                  <p className="mt-4 text-sm text-ink-500">
                    Answered by {submission.handledBy.firstName}{' '}
                    {submission.handledBy.lastName} on{' '}
                    {formatDate(submission.handledAt)}.
                  </p>
                )}

                {canManage && (
                  <div className="mt-6 border-t border-ink-100 pt-6">
                    <DecisionForm
                      action={setSubmissionStatus}
                      idField="submissionId"
                      idValue={submission.id}
                      options={STATUS_OPTIONS}
                      label="Mark as"
                    />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
