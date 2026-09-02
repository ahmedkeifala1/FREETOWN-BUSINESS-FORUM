import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Badge, Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  CardGrid,
  Container,
  CtaBand,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  BUSINESS_SIZE_LABELS,
  MemberStatus,
  type BusinessSize,
} from '@/lib/enums'
import { formatDate, initials, paragraphs, truncate } from '@/lib/format'
import { isStaff } from '@/lib/rbac'

/**
 * A member's directory profile (SDR §4.11).
 *
 * The page splits in two on purpose. Everything above the contact panel is
 * public — that is what makes the directory worth being in, and what a search
 * engine indexes. The contact details are shown only to signed-in members
 * ("richer detail visible to logged-in members", §4.11).
 *
 * The gate is a server-side check on the session, not a hidden block: the
 * contact fields are never fetched into the public branch, so there is nothing
 * to find in the page source. Hiding a link is not access control (see
 * lib/rbac.ts) and neither is hiding a phone number.
 */

type Params = { slug: string }

async function getListing(slug: string) {
  return db.directoryListing.findFirst({
    where: { slug, isPublished: true },
    include: {
      sector: { select: { slug: true, name: true } },
      member: {
        select: {
          status: true,
          joinedAt: true,
          tier: { select: { name: true } },
        },
      },
    },
  })
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { slug } = await params
  const listing = await getListing(slug)

  if (!listing) return { title: 'Business not found' }

  return {
    title: listing.businessName,
    description: truncate(listing.shortDescription, 200),
    alternates: { canonical: `/directory/${listing.slug}` },
    openGraph: {
      type: 'profile',
      title: listing.businessName,
      description: truncate(listing.shortDescription, 200),
      images: listing.logoUrl ? [listing.logoUrl] : undefined,
    },
  }
}

export default async function ListingPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { slug } = await params

  const [listing, user] = await Promise.all([getListing(slug), getCurrentUser()])

  if (!listing) notFound()

  // Members in good standing, and staff — the secretariat has to be able to
  // reach a member from the page it maintains. A lapsed membership loses the
  // directory's contact details along with everything else it paid for.
  const canSeeContact =
    user !== null &&
    (isStaff(user.role) || user.memberStatus === MemberStatus.ACTIVE)

  const related = listing.sector
    ? await db.directoryListing.findMany({
        where: {
          isPublished: true,
          sectorId: listing.sectorId,
          NOT: { id: listing.id },
        },
        orderBy: [{ isFeatured: 'desc' }, { businessName: 'asc' }],
        take: 3,
        select: {
          id: true,
          slug: true,
          businessName: true,
          shortDescription: true,
          logoUrl: true,
        },
      })
    : []

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Business directory', href: '/directory' },
          { label: listing.businessName, href: `/directory/${listing.slug}` },
        ]}
      />

      <section className="bg-ink-950 text-white">
        <Container size="wide" className="py-12 sm:py-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <ListingLogo
              logoUrl={listing.logoUrl}
              name={listing.businessName}
            />

            <div className="min-w-0 flex-1">
              {listing.sector && (
                <Link
                  href={`/directory?sector=${listing.sector.slug}`}
                  className="text-sm font-semibold uppercase tracking-widest text-gold-400 hover:underline"
                >
                  {listing.sector.name}
                </Link>
              )}

              <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {listing.businessName}
              </h1>

              <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/80">
                {listing.shortDescription}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {listing.region && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm text-white/85">
                    <Icon name="pin" className="size-4" />
                    {listing.region}
                  </span>
                )}
                {listing.size && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm text-white/85">
                    <Icon name="users" className="size-4" />
                    {BUSINESS_SIZE_LABELS[listing.size as BusinessSize] ??
                      listing.size}
                  </span>
                )}
                {listing.member.status === MemberStatus.ACTIVE && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-600 px-3 py-1 text-sm font-medium text-white">
                    <Icon name="check" className="size-4" />
                    {listing.member.tier.name} member
                  </span>
                )}
              </div>
            </div>
          </div>
        </Container>
      </section>

      <Section tone="white" size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ── The profile ────────────────────────────────────────────── */}

          <div className="lg:col-span-7">
            <h2 className="text-2xl text-ink-950 sm:text-3xl">
              About {listing.businessName}
            </h2>

            <div className="mt-5 space-y-4 leading-relaxed text-ink-700">
              {listing.fullDescription ? (
                paragraphs(listing.fullDescription).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))
              ) : (
                <p>{listing.shortDescription}</p>
              )}
            </div>

            {(listing.yearFounded ||
              listing.employees ||
              listing.member.joinedAt) && (
              <dl className="mt-10 grid gap-6 border-t border-ink-200 pt-8 sm:grid-cols-3">
                {listing.yearFounded && (
                  <Fact label="Founded" value={String(listing.yearFounded)} />
                )}
                {listing.employees && (
                  <Fact
                    label="Employees"
                    value={listing.employees.toLocaleString('en-GB')}
                  />
                )}
                {listing.member.joinedAt && (
                  <Fact
                    label="FBF member since"
                    value={formatDate(listing.member.joinedAt)}
                  />
                )}
              </dl>
            )}
          </div>

          {/* ── Contact — members only ─────────────────────────────────── */}

          <div className="lg:col-span-5">
            <Card className="lg:sticky lg:top-24">
              <h2 className="font-display text-lg font-semibold text-ink-950">
                Get in touch
              </h2>

              {canSeeContact ? (
                <ul className="mt-5 space-y-4">
                  {listing.website && (
                    <ContactRow icon="globe" label="Website">
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-medium text-forest-700 hover:underline"
                      >
                        {listing.website.replace(/^https?:\/\//, '')}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </ContactRow>
                  )}

                  {listing.contactEmail && (
                    <ContactRow icon="mail" label="Email">
                      <a
                        href={`mailto:${listing.contactEmail}`}
                        className="font-medium text-forest-700 hover:underline"
                      >
                        {listing.contactEmail}
                      </a>
                    </ContactRow>
                  )}

                  {listing.contactPhone && (
                    <ContactRow icon="phone" label="Phone">
                      <a
                        href={`tel:${listing.contactPhone.replace(/\s+/g, '')}`}
                        className="font-medium text-forest-700 hover:underline"
                      >
                        {listing.contactPhone}
                      </a>
                    </ContactRow>
                  )}

                  {listing.address && (
                    <ContactRow icon="pin" label="Address">
                      <address className="not-italic text-ink-700">
                        {listing.address}
                      </address>
                    </ContactRow>
                  )}

                  {!listing.website &&
                    !listing.contactEmail &&
                    !listing.contactPhone &&
                    !listing.address && (
                      <li className="text-sm text-ink-600">
                        This member has not published contact details. The
                        secretariat can pass a message on.
                      </li>
                    )}
                </ul>
              ) : (
                <MemberGate />
              )}
            </Card>
          </div>
        </div>
      </Section>

      {related.length > 0 && listing.sector && (
        <Section tone="muted" size="wide">
          <SectionHeading
            eyebrow="Same sector"
            title={`Other ${listing.sector.name.toLowerCase()} members`}
          />

          <CardGrid columns={3} className="mt-10">
            {related.map((other) => (
              <Link
                key={other.id}
                href={`/directory/${other.slug}`}
                className="group flex h-full flex-col rounded-xl border border-ink-200 bg-white p-5 shadow-sm transition hover:border-forest-300 hover:shadow-md sm:p-6"
              >
                <h3 className="font-display text-base font-semibold text-ink-950 group-hover:text-forest-700">
                  {other.businessName}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                  {truncate(other.shortDescription, 120)}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                  View profile
                  <Icon name="arrowRight" className="size-4" />
                </span>
              </Link>
            ))}
          </CardGrid>
        </Section>
      )}

      <CtaBand
        title="Put your business in front of the same people"
        lead="A directory listing comes with every membership tier — and it is the page investors and buyers actually land on."
      >
        <ButtonLink
          href="/membership/apply"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Apply for membership
        </ButtonLink>
        <ButtonLink
          href="/directory"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          Back to the directory
        </ButtonLink>
      </CtaBand>
    </>
  )
}

/**
 * What a visitor sees where the contact details would be.
 *
 * It names what is behind the gate rather than just refusing. A panel that
 * says "members only" and nothing else reads as a dark pattern; one that says
 * which four fields are there lets someone decide whether joining is worth it.
 */
function MemberGate() {
  return (
    <div className="mt-5">
      <div className="flex gap-3 rounded-lg bg-ink-50 p-4">
        <Icon name="shield" className="mt-0.5 size-5 shrink-0 text-ink-500" />
        <div>
          <p className="text-sm font-medium text-ink-900">
            Contact details are shown to members
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Website, email, telephone and address. Members can see them on every
            listing in the directory.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        <ButtonLink href="/membership/apply" variant="accent" fullWidth>
          Become a member
        </ButtonLink>
        <ButtonLink href="/portal/login" variant="outline" fullWidth>
          Sign in
        </ButtonLink>
      </div>
    </div>
  )
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: string
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-3">
      <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-forest-600" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </p>
        <div className="mt-0.5 break-words">{children}</div>
      </div>
    </li>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-semibold text-ink-950">
        {value}
      </dd>
    </div>
  )
}

function ListingLogo({
  logoUrl,
  name,
}: {
  logoUrl: string | null
  name: string
}) {
  if (logoUrl) {
    return (
      // Remote CMS URL — see the note in ui/card.tsx.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="size-24 shrink-0 rounded-xl bg-white object-contain p-2 sm:size-28"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-white/10 font-display text-2xl font-bold text-white/70 sm:size-28 sm:text-3xl"
    >
      {initials(name)}
    </span>
  )
}
