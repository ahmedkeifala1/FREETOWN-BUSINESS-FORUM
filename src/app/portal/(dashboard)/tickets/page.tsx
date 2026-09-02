import Link from 'next/link'
import type { Metadata } from 'next'

import { StatusBadge } from '@/components/site/status-badge'
import { ButtonLink } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '@/components/ui/icon'
import { EmptyState } from '@/components/ui/layout'
import { RegistrationStatus } from '@/lib/enums'
import { formatDate, formatDateRange } from '@/lib/format'
import { formatMoney, isCurrency } from '@/lib/money'
import { getMyRegistrations } from '@/lib/portal'
import { requireUser } from '@/lib/rbac'
import { renderQrSvg } from '@/lib/tickets'

/**
 * My tickets (§4.16 "tickets/QR codes, event schedule, downloads").
 *
 * The QR codes are rendered here rather than linked to as images so that the
 * page works offline once loaded — a delegate at a registration desk with no
 * signal is exactly the moment the ticket has to be on screen, and that is
 * also why nothing on this page needs printing.
 *
 * Only confirmed registrations produce codes. Generating one for an unpaid
 * place would put a scannable ticket in someone's hand for a seat they have
 * not bought, and the desk cannot be expected to notice.
 */

export const metadata: Metadata = {
  title: 'My tickets',
}

export default async function PortalTicketsPage() {
  const user = await requireUser({ redirectTo: '/portal/tickets' })
  const registrations = await getMyRegistrations(user)

  const live = registrations.filter(
    (r) => r.status !== RegistrationStatus.CANCELLED,
  )

  // CPU work, so it is done once for the whole page and in parallel — and only
  // for the registrations that have actually been paid for.
  const withTickets = await Promise.all(
    live.map(async (registration) => ({
      registration,
      tickets:
        registration.status === RegistrationStatus.CONFIRMED
          ? await Promise.all(
              registration.delegates.map(async (delegate) => ({
                id: delegate.id,
                name: `${delegate.firstName} ${delegate.lastName}`,
                code: delegate.ticketCode,
                checkedInAt: delegate.checkedInAt,
                svg: await renderQrSvg(delegate.qrPayload),
              })),
            )
          : [],
    })),
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">
          My tickets
        </h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Show the QR code at the registration desk — on your phone is fine,
          there is nothing to print.
        </p>
      </header>

      {withTickets.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          message="When you register for the forum your e-tickets appear here, and a copy is emailed to you."
        >
          <ButtonLink href="/register" size="md">
            Register for the forum
          </ButtonLink>
        </EmptyState>
      ) : (
        withTickets.map(({ registration, tickets }) => {
          const currency = registration.currency

          return (
            <section key={registration.id} className="space-y-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink-950">
                      {registration.event.name}
                    </h2>
                    <p className="mt-1 text-sm text-ink-600">
                      {formatDateRange(
                        registration.event.startDate,
                        registration.event.endDate,
                      )}
                      {' · '}
                      {registration.event.venueName},{' '}
                      {registration.event.city}
                    </p>
                    <p className="mt-2 text-sm text-ink-600">
                      <span className="font-mono">{registration.reference}</span>
                      {' · '}
                      {registration.ticketType.name}
                      {' · '}
                      {isCurrency(currency)
                        ? formatMoney(registration.totalMinor, currency)
                        : registration.totalMinor}
                    </p>
                  </div>

                  <StatusBadge status={registration.status} />
                </div>

                {/* ── Not yet payable / not yet paid ──────────────────── */}

                {registration.status !== RegistrationStatus.CONFIRMED && (
                  <div className="mt-5 flex gap-3 rounded-xl bg-amber-50 p-4">
                    <Icon
                      name="clock"
                      className="mt-0.5 size-5 shrink-0 text-amber-700"
                    />
                    <div className="text-sm leading-relaxed text-ink-700">
                      <p className="font-medium text-ink-950">
                        E-tickets are issued once payment clears.
                      </p>
                      <p className="mt-1">
                        {registration.payment?.method === 'OFFLINE'
                          ? 'Your invoice has been issued — quote the reference on the transfer and the tickets appear here automatically.'
                          : 'If you started a payment and it did not complete, you can pick it up where you left off.'}
                      </p>
                      <Link
                        href={`/register/${registration.reference}`}
                        className="mt-2 inline-flex items-center gap-1.5 font-medium text-forest-700 hover:underline"
                      >
                        Open this registration
                        <Icon name="arrowRight" className="size-4" />
                      </Link>
                    </div>
                  </div>
                )}

                {/* ── The tickets ─────────────────────────────────────── */}

                {tickets.length > 0 && (
                  <div className="mt-6 grid gap-4 border-t border-ink-100 pt-6 sm:grid-cols-2">
                    {tickets.map((ticket, index) => (
                      <div
                        key={ticket.id}
                        className="rounded-xl border border-ink-200 p-5 text-center"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">
                          Delegate {index + 1} of {tickets.length}
                        </p>

                        <div
                          /*
                           * Generated by the qrcode library from an opaque
                           * signed code — no delegate data and no user-supplied
                           * string, so there is nothing for an injected script
                           * to ride in on (NFR-05).
                           */
                          className="mx-auto mt-4 w-36 [&>svg]:size-full"
                          dangerouslySetInnerHTML={{ __html: ticket.svg }}
                        />

                        <p className="mt-4 font-display text-base font-bold tracking-wide text-ink-950">
                          {ticket.code}
                        </p>
                        <p className="mt-1 text-sm text-ink-600">
                          {ticket.name}
                        </p>

                        {ticket.checkedInAt && (
                          <p className="mt-2 text-xs font-medium text-forest-700">
                            Checked in {formatDate(ticket.checkedInAt)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {tickets.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <ButtonLink href="/events/agenda" variant="outline" size="md">
                    Agenda
                  </ButtonLink>
                  <ButtonLink href="/events/venue" variant="ghost" size="md">
                    Venue &amp; travel
                  </ButtonLink>
                  <ButtonLink
                    href="/learning-hub/downloads"
                    variant="ghost"
                    size="md"
                  >
                    Downloads
                  </ButtonLink>
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
