import type { Metadata } from 'next'

import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import {
  Breadcrumbs,
  Container,
  CtaBand,
  PageHero,
  Section,
  SectionHeading,
} from '@/components/ui/layout'
import { formatDateRange, paragraphs } from '@/lib/format'
import { getCurrentEvent, getPageBlocks } from '@/lib/settings'

/**
 * Venue & travel (SDR §4.8).
 *
 * Written for the delegate who has already decided to come and now has to
 * get here: where the venue is, how to reach the country, whether a visa is
 * needed, where to sleep, and what to expect on the ground. Ordered that way
 * rather than by importance to the forum.
 *
 * Venue facts come from the event row; the guidance blocks come from the
 * `venue-travel` CMS page, because visa rules and hotel blocks change between
 * editions and must be editable without a redeploy (FR-01, FR-02).
 */

export const metadata: Metadata = {
  title: 'Venue & travel',
  description:
    'Where the Freetown Business Forum is held, how to get there, visa guidance, hotels and practical information for delegates.',
  alternates: { canonical: '/events/venue' },
}

const GUIDE_SECTIONS = [
  {
    key: 'gettingHere',
    icon: 'globe',
    title: 'Getting here',
    fallback:
      'Freetown is served by Lungi International Airport. Transfer details and recommended operators are published closer to the forum.',
  },
  {
    key: 'visas',
    icon: 'document',
    title: 'Visas & entry',
    fallback:
      'Most nationalities require a visa. Check the current requirements with the Sierra Leone immigration service well before you travel.',
  },
  {
    key: 'hotels',
    icon: 'building',
    title: 'Where to stay',
    fallback:
      'Rooms are held at hotels near the venue at negotiated rates. The secretariat can confirm what is available.',
  },
  {
    key: 'practical',
    icon: 'smartphone',
    title: 'On the ground',
    fallback:
      'The currency is the Leone (SLE). Mobile money is widely accepted, and English is the official language.',
  },
] as const

export default async function VenuePage() {
  const [event, blocks] = await Promise.all([
    getCurrentEvent(),
    getPageBlocks('venue-travel'),
  ])

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Events', href: '/events' },
          { label: 'Venue & travel', href: '/events/venue' },
        ]}
      />

      <PageHero
        eyebrow={
          event
            ? formatDateRange(event.startDate, event.endDate)
            : (blocks.eyebrow ?? 'Events')
        }
        title={blocks.heroTitle ?? 'Venue &'}
        accent={blocks.heroAccent ?? 'travel'}
        lead={
          blocks.intro ??
          'Everything you need to plan the trip — where the forum is held, how to get here and what to expect when you arrive.'
        }
      >
        {event?.venueMapUrl && (
          <a
            href={event.venueMapUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-12 items-center justify-center gap-2 bg-gold-600 px-6 py-3 text-base font-semibold uppercase tracking-wider text-white hover:bg-gold-700"
          >
            <Icon name="pin" className="size-5" />
            {blocks.mapLinkLabel ?? 'Open in Maps'}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </PageHero>

      {/* ── The venue ────────────────────────────────────────────────────── */}

      {event && (
        <Section tone="white" size="wide">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <SectionHeading
                eyebrow={blocks.venueEyebrow ?? 'The venue'}
                title={event.venueName}
              />

              <address className="mt-6 not-italic leading-relaxed text-ink-700">
                {event.venueAddress}
                <br />
                {event.city}, {event.country}
              </address>

              <dl className="mt-8 space-y-5">
                <VenueFact
                  icon="calendar"
                  label="Dates"
                  value={formatDateRange(event.startDate, event.endDate)}
                />
                {event.expectedDelegates && (
                  <VenueFact
                    icon="users"
                    label="Expected attendance"
                    value={`${event.expectedDelegates.toLocaleString('en-GB')} delegates`}
                  />
                )}
                <VenueFact
                  icon="pin"
                  label="Nearest airport"
                  value="Lungi International (FNA)"
                />
              </dl>

              {event.venueMapUrl && (
                <a
                  href={event.venueMapUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-8 inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
                >
                  Directions to the venue
                  <Icon name="arrowRight" className="size-4" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
            </div>

            <div className="lg:col-span-7">
              <VenueMap
                lat={event.venueLat}
                lng={event.venueLng}
                venueName={event.venueName}
                mapUrl={event.venueMapUrl}
              />
            </div>
          </div>
        </Section>
      )}

      {/* ── Travel guidance ──────────────────────────────────────────────── */}

      <Section tone="muted" size="wide">
        <SectionHeading
          eyebrow={blocks.guidanceEyebrow ?? 'Planning the trip'}
          title={blocks.guidanceTitle ?? 'What you need to know'}
          lead={
            blocks.guidanceLead ??
            'Guidance for delegates travelling from outside Sierra Leone. Check anything time-sensitive — visa rules in particular — against the official source before you book.'
          }
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {GUIDE_SECTIONS.map(({ key, icon, title, fallback }) => (
            <Card key={key} className="h-full">
              <div className="flex items-center gap-3">
                <Icon name={icon} className="size-6 shrink-0 text-forest-600" />
                <h3 className="font-display text-lg font-semibold text-ink-950">
                  {title}
                </h3>
              </div>

              <div className="mt-4 space-y-3 leading-relaxed text-ink-700">
                {paragraphs(blocks[key] ?? fallback).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <p className="mt-8 max-w-2xl text-sm text-ink-600">
          {blocks.invitationNote ??
            'Delegates who need a letter of invitation for a visa application should register first, then email the secretariat with their registration reference — the letter names the delegate and cannot be issued before the registration exists.'}
        </p>
      </Section>

      {/* ── Accessibility ────────────────────────────────────────────────── */}

      <Section tone="white">
        <Container size="narrow" className="px-0">
          <SectionHeading
            eyebrow={blocks.accessEyebrow ?? 'Access'}
            title={
              blocks.accessTitle ?? 'Accessibility and dietary requirements'
            }
          />

          <div className="mt-6 space-y-4 leading-relaxed text-ink-700">
            {blocks.accessibility ? (
              paragraphs(blocks.accessibility).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))
            ) : (
              <p>
                Tell us what you need and it will be arranged. The registration
                form has a field for access requirements and dietary needs, and
                anything entered there reaches the events team directly. If
                something is missed, the secretariat can be reached at any point
                before the forum.
              </p>
            )}
          </div>

          <ButtonLink href="/contact" variant="outline" className="mt-8">
            Contact the events team
          </ButtonLink>
        </Container>
      </Section>

      <CtaBand
        title={blocks.ctaTitle ?? 'Book the trip'}
        lead={
          blocks.ctaLead ??
          'Registration closes when the venue is full, and the hotel block is released well before the forum opens.'
        }
      >
        <ButtonLink
          href="/register"
          variant="accent"
          size="lg"
          className="rounded-none font-semibold uppercase tracking-wider"
        >
          Register to attend
        </ButtonLink>
        <ButtonLink
          href="/events/agenda"
          size="lg"
          className="rounded-none border border-white/40 bg-transparent font-semibold uppercase tracking-wider text-white hover:bg-white/10"
        >
          See the programme
        </ButtonLink>
      </CtaBand>
    </>
  )
}

function VenueFact({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div className="flex gap-3">
      <Icon name={icon} className="mt-0.5 size-5 shrink-0 text-forest-600" />
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </dt>
        <dd className="mt-0.5 font-medium text-ink-950">{value}</dd>
      </div>
    </div>
  )
}

/**
 * The embedded map (§4.8).
 *
 * OpenStreetMap rather than Google Maps: it needs no API key, no consent
 * banner and no third-party cookie, and the embed is a fraction of the weight
 * on a 3G connection (NFR-01, NFR-05). `loading="lazy"` keeps it off the
 * critical path entirely — the map is below the venue address, which is the
 * information most people came for.
 *
 * Without coordinates there is nothing to embed, so the panel degrades to a
 * link-out rather than rendering an empty grey box.
 */
function VenueMap({
  lat,
  lng,
  venueName,
  mapUrl,
}: {
  lat: number | null
  lng: number | null
  venueName: string
  mapUrl: string | null
}) {
  if (lat === null || lng === null) {
    return (
      <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-ink-300 bg-ink-50 p-8 text-center">
        <Icon name="pin" className="size-8 text-ink-400" />
        <p className="text-sm text-ink-600">
          A map of {venueName} is being added.
        </p>
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium text-forest-700 hover:underline"
          >
            Find it on Maps
          </a>
        )}
      </div>
    )
  }

  // A small bounding box around the venue — tight enough to show the streets
  // around it without the reader having to zoom.
  const delta = 0.012
  const bbox = [lng - delta, lat - delta / 2, lng + delta, lat + delta / 2].join(
    ',',
  )

  return (
    <figure>
      <iframe
        title={`Map showing ${venueName}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
        className="aspect-4/3 w-full rounded-xl border border-ink-200 bg-ink-100"
      />

      <figcaption className="mt-3 text-sm text-ink-600">
        {venueName} —{' '}
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer noopener"
          className="font-medium text-forest-700 hover:underline"
        >
          view a larger map
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </figcaption>
    </figure>
  )
}
