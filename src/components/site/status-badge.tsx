import { Badge } from '@/components/ui/card'

/**
 * Status badges, in one place.
 *
 * The portal and the admin panel show the same statuses, and a member number
 * that reads "Active" in green on one screen and "ACTIVE" in grey on another
 * looks like two different systems. Mapping lives here so the vocabulary and
 * the colour that goes with it are decided once.
 *
 * Colour is never the only signal — the word is always present — because a
 * red badge and a green badge are the same badge to a colour-blind reader
 * (WCAG 1.4.1).
 */

type Tone = 'forest' | 'harbour' | 'gold' | 'neutral' | 'success' | 'warning' | 'danger'

const TONES: Record<string, { tone: Tone; label: string }> = {
  // Membership
  PENDING: { tone: 'warning', label: 'Pending' },
  ACTIVE: { tone: 'success', label: 'Active' },
  EXPIRED: { tone: 'danger', label: 'Expired' },
  SUSPENDED: { tone: 'danger', label: 'Suspended' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },

  // Registrations
  CONFIRMED: { tone: 'success', label: 'Confirmed' },
  REFUNDED: { tone: 'neutral', label: 'Refunded' },

  // Payments
  PROCESSING: { tone: 'warning', label: 'Processing' },
  PAID: { tone: 'success', label: 'Paid' },
  FAILED: { tone: 'danger', label: 'Failed' },

  // Invoices
  ISSUED: { tone: 'harbour', label: 'Issued' },
  VOID: { tone: 'neutral', label: 'Void' },
  OVERDUE: { tone: 'danger', label: 'Overdue' },

  // Applications and access requests
  SUBMITTED: { tone: 'harbour', label: 'Submitted' },
  UNDER_REVIEW: { tone: 'warning', label: 'Under review' },
  SHORTLISTED: { tone: 'gold', label: 'Shortlisted' },
  APPROVED: { tone: 'success', label: 'Approved' },
  REJECTED: { tone: 'danger', label: 'Not taken forward' },
  DECLINED: { tone: 'danger', label: 'Declined' },

  // Content
  DRAFT: { tone: 'neutral', label: 'Draft' },
  PUBLISHED: { tone: 'success', label: 'Published' },
  ARCHIVED: { tone: 'neutral', label: 'Archived' },
  CLOSED: { tone: 'neutral', label: 'Closed' },
}

export function StatusBadge({ status }: { status: string }) {
  const known = TONES[status]

  // An unmapped value is shown rather than swallowed: a status nobody styled
  // is a bug, and a blank space where the badge should be hides it.
  return (
    <Badge tone={known?.tone ?? 'neutral'}>
      {known?.label ?? status.replaceAll('_', ' ').toLowerCase()}
    </Badge>
  )
}
