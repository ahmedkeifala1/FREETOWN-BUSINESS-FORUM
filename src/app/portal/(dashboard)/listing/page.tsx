import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { DirectoryListingForm } from '@/components/site/directory-listing-form'
import { ListingVisibility } from '@/components/site/listing-visibility'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { db } from '@/lib/db'
import { MemberStatus } from '@/lib/enums'
import { formatDate } from '@/lib/format'
import { getMyMembership } from '@/lib/portal'
import { requireUser } from '@/lib/rbac'

/**
 * Directory listing management (§4.16 "directory listing management").
 *
 * The visibility control sits above the form, not below it. Whether the entry
 * is public is the thing a member came here to check; the wording of the third
 * paragraph is what they came to change once they had checked.
 */

export const metadata: Metadata = {
  title: 'Directory listing',
}

export default async function PortalListingPage() {
  const user = await requireUser({ redirectTo: '/portal/listing' })

  // Non-members have no listing to manage. The nav does not offer this page to
  // them, but the nav is not the guard (§12).
  if (!user.memberId) redirect('/membership')

  const [membership, sectors] = await Promise.all([
    getMyMembership(user),
    db.sector.findMany({
      where: { isPublished: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  if (!membership) redirect('/portal')

  const listing = membership.listing
  const canPublish = membership.status === MemberStatus.ACTIVE

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          Directory listing
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Your entry in the business directory — what other members and visiting
          investors see when they search your sector.
        </p>
      </header>

      {/* ── Visibility ──────────────────────────────────────────────────── */}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-950">
              {listing?.isPublished ? 'Live in the directory' : 'Not published'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {listing?.isPublished ? (
                <>
                  Anyone browsing the directory can find you.{' '}
                  <Link
                    href={`/directory/${listing.slug}`}
                    className="font-medium text-forest-700 hover:underline"
                  >
                    View your entry
                  </Link>
                  .
                </>
              ) : (
                'Only you and the secretariat can see this. Nothing below is public until you publish it.'
              )}
            </p>
            {listing?.updatedAt && (
              <p className="mt-1 text-sm text-ink-500">
                Last edited {formatDate(listing.updatedAt)}.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-ink-100 pt-5">
          <ListingVisibility
            isPublished={listing?.isPublished ?? false}
            canPublish={canPublish && Boolean(listing)}
          />
        </div>
      </Card>

      {/* ── The entry ───────────────────────────────────────────────────── */}

      <Card>
        <DirectoryListingForm
          sectors={sectors}
          defaults={
            listing
              ? {
                  businessName: listing.businessName,
                  shortDescription: listing.shortDescription,
                  fullDescription: listing.fullDescription,
                  sectorId: listing.sectorId,
                  region: listing.region,
                  size: listing.size,
                  logoUrl: listing.logoUrl,
                  website: listing.website,
                  contactEmail: listing.contactEmail,
                  contactPhone: listing.contactPhone,
                  address: listing.address,
                  yearFounded: listing.yearFounded,
                  employees: listing.employees,
                }
              : null
          }
        />
      </Card>

      <div className="flex gap-3 rounded-xl bg-ink-50 p-5">
        <Icon name="search" className="mt-0.5 size-5 shrink-0 text-ink-500" />
        <p className="text-sm leading-relaxed text-ink-600">
          Members are found by sector and region far more often than by name.
          Choosing both, and saying plainly what you sell in the short
          description, is worth more than a long profile nobody filters into.
        </p>
      </div>
    </div>
  )
}
