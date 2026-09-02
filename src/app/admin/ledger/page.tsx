import type { Metadata } from 'next'

import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/layout'
import { db } from '@/lib/db'
import { LedgerEntryType } from '@/lib/enums'
import { formatMoney, isCurrency } from '@/lib/money'
import { Permission, requirePermission } from '@/lib/rbac'

/**
 * The ledger (FR-14, §14).
 *
 * Append-only and read-only: every settled payment writes a balanced pair of
 * entries, and nothing in the application updates or deletes a row. There is
 * deliberately no control on this screen — a ledger with an edit button is a
 * spreadsheet.
 *
 * The account summary is grouped by currency as well as by account. Adding SLE
 * to USD would produce a number that is wrong in both, and the forum takes
 * both.
 */

export const metadata: Metadata = {
  title: 'Ledger',
}

const PAGE_SIZE = 100

export default async function AdminLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requirePermission(Permission.LEDGER_VIEW, {
    redirectTo: '/admin/ledger',
  })

  const { page: rawPage } = await searchParams
  const page = Math.max(1, Number(rawPage) || 1)

  const [entries, total, byAccount] = await Promise.all([
    db.ledgerEntry.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        entryType: true,
        account: true,
        currency: true,
        amountMinor: true,
        description: true,
        createdAt: true,
        payment: { select: { reference: true } },
      },
    }),
    db.ledgerEntry.count(),
    db.ledgerEntry.groupBy({
      by: ['account', 'currency', 'entryType'],
      _sum: { amountMinor: true },
    }),
  ])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Net per account per currency: debits less credits.
  const balances = new Map<string, { account: string; currency: string; net: number }>()

  for (const row of byAccount) {
    const key = `${row.account}|${row.currency}`
    const current = balances.get(key) ?? {
      account: row.account,
      currency: row.currency,
      net: 0,
    }
    const amount = row._sum.amountMinor ?? 0
    current.net +=
      row.entryType === LedgerEntryType.DEBIT ? amount : -amount
    balances.set(key, current)
  }

  const summary = [...balances.values()].sort((a, b) =>
    a.account.localeCompare(b.account),
  )

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold text-ink-950">Ledger</h1>
        <p className="mt-2 leading-relaxed text-ink-600">
          Double-entry, append-only. Every settled payment writes a balanced
          pair; nothing here is ever edited or removed.
        </p>
      </header>

      {/* ── Balances ────────────────────────────────────────────────────── */}

      {summary.length > 0 && (
        <Card padded={false}>
          <h2 className="px-5 pt-5 font-display text-lg font-semibold text-ink-950 sm:px-6 sm:pt-6">
            Account balances
          </h2>

          <ul className="mt-4 divide-y divide-ink-100 border-t border-ink-100">
            {summary.map((row) => (
              <li
                key={`${row.account}|${row.currency}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6"
              >
                <span className="font-mono text-sm text-ink-800">
                  {row.account}
                </span>
                <span className="font-medium text-ink-950">
                  {isCurrency(row.currency)
                    ? formatMoney(Math.abs(row.net), row.currency)
                    : Math.abs(row.net)}
                  <span className="ml-1.5 text-xs font-normal text-ink-500">
                    {row.net < 0 ? 'CR' : 'DR'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Entries ─────────────────────────────────────────────────────── */}

      {entries.length === 0 ? (
        <EmptyState
          title="No entries yet"
          message="The ledger fills as payments settle."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Ledger entries, most recent first
              </caption>
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wider text-ink-500">
                  <th scope="col" className="px-6 py-3 font-semibold">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 font-semibold">
                    Account
                  </th>
                  <th scope="col" className="px-6 py-3 font-semibold">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold">
                    Debit
                  </th>
                  <th scope="col" className="px-6 py-3 text-right font-semibold">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {entries.map((entry) => {
                  const amount = isCurrency(entry.currency)
                    ? formatMoney(entry.amountMinor, entry.currency)
                    : String(entry.amountMinor)
                  const isDebit = entry.entryType === LedgerEntryType.DEBIT

                  return (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap px-6 py-3 text-ink-600">
                        {entry.createdAt.toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-ink-800">
                        {entry.account}
                      </td>
                      <td className="px-6 py-3 text-ink-700">
                        {entry.description}
                        {entry.payment && (
                          <span className="mt-0.5 block font-mono text-xs text-ink-500">
                            {entry.payment.reference}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-ink-950">
                        {isDebit ? amount : ''}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-ink-950">
                        {isDebit ? '' : amount}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pageCount > 1 && (
        <nav
          aria-label="Ledger pages"
          className="flex items-center justify-between gap-4 text-sm"
        >
          {page > 1 ? (
            <a
              href={`/admin/ledger?page=${page - 1}`}
              className="font-medium text-forest-700 hover:underline"
            >
              Newer
            </a>
          ) : (
            <span />
          )}

          <span className="text-ink-600">
            Page {page} of {pageCount}
          </span>

          {page < pageCount ? (
            <a
              href={`/admin/ledger?page=${page + 1}`}
              className="font-medium text-forest-700 hover:underline"
            >
              Older
            </a>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  )
}
