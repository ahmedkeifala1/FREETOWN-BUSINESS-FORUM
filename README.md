# Sierra Leone Business Forum (SLBF)

A dynamic, database-driven web application implementing the SLBF System Design
Requirement (SDR v1.1). Every content page is generated from the database and
managed through the admin panel — publishing requires no redeploy.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, React 19, Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, design tokens in `src/app/globals.css` |
| Database | SQLite in development, Postgres in production, via Prisma 7 |
| Auth | Server-side sessions, bcrypt, opaque cookie tokens |
| Validation | Zod at every write |
| Payments | Orange Money, Afrimoney, card (hosted page), offline invoice |

The SDR names PHP/Laravel or WordPress as the primary recommendation with
Next.js as the alternative (§8). Next.js was taken because the Deal Room,
dynamic ticket pricing and delegate portal are custom application logic rather
than CMS content, and a headless build keeps the payment module isolated as
§7 requires.

## Getting started

```bash
npm install
cp .env.example .env      # then fill in AUTH_SECRET and TICKET_SECRET
npm run db:migrate        # create the schema
npm run db:seed           # load sectors, the forum, speakers, content
npm run dev
```

Open http://localhost:3000.

The seed creates four staff accounts and eight member accounts, all with the
password `SLBFdev2026!`:

| Account | Role |
|---------|------|
| `admin@slbf.sl` | Administrator |
| `editor@slbf.sl` | Editor |
| `events@slbf.sl` | Event manager |
| `finance@slbf.sl` | Finance |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` (run `next build` first — it generates route types) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Seed content (idempotent — safe to re-run) |
| `npm run db:studio` | Browse the database |
| `npm run db:reset` | Drop, re-migrate and re-seed |

## Layout

```
prisma/
  schema.prisma      Database design (SDR §9)
  seed.ts            Seed content — idempotent, keyed on natural keys
src/
  app/               Routes. Server Components by default.
  components/
    site/            Header, footer, navigation — the global chrome (§3.5)
    ui/              Buttons, cards, forms, icons, layout primitives
  lib/
    auth.ts          Sessions, password hashing, reset tokens (FR-03)
    rbac.ts          Permissions and route guards (FR-04, §12)
    validation.ts    Zod schemas — every write passes through here
    pricing.ts       Ticket quotes: tiers, group discounts, promos (FR-06)
    tickets.ts       QR e-tickets, HMAC-signed (FR-05)
    notifications.ts Email and SMS via the outbox table (FR-08)
    payments/        Gateway drivers, one per method (FR-07)
    money.ts         Minor-unit arithmetic — no floats touch a price
```

## Conventions

**Money** is always an integer in the currency's minor unit, with the currency
code alongside it. No float ever touches a price, a discount or a ledger entry.

**Status columns** are `String` in the database because SQLite has no enum type.
`src/lib/enums.ts` is the single source of truth for permitted values and
`src/lib/validation.ts` enforces them at runtime. Never write a bare string
literal to one.

**Permissions** are checked server-side on every protected action via
`src/lib/rbac.ts`. Hiding a link is not access control.

**Prices are never trusted from the browser.** Step 1 of registration shows an
estimate; the figure charged is always recomputed server-side from the ticket
type and promo code IDs.

## Status

Built and verified:

- Database schema, migrations and seed content
- Auth, RBAC, validation, pricing, QR ticketing, payment gateways, notifications
- Design system, global header/footer, homepage (§4.2), error and 404 pages

Not yet built — the remaining route work:

- About, Forum (overview, agenda, speakers, sponsors, venue), News, Media, Contact
- Registration flow (§4.9) and the payment callback routes
- Membership pages, application flow and the business directory
- Invest & Deal Room pages, funding applications, investor access requests
- Member/delegate portal and the admin panel

## Deployment

Set every variable in `.env.example` in the host environment. In production:

- `PAYMENTS_MODE=live` requires all gateway credentials — the app refuses to
  start without them rather than accepting registrations it cannot collect.
- Switch `provider` in `prisma/schema.prisma` and the adapter in `src/lib/db.ts`
  to Postgres. No query code changes.
- `TICKET_SECRET` must be stable for the life of an event — rotating it
  invalidates every e-ticket already issued.
