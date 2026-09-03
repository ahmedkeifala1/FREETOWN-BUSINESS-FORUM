# Freetown Business Forum (FBF)

A dynamic, database-driven web application for the Freetown Business Forum, a
non-profit founded on 12 December 2023 to empower Sierra Leone’s business
community. It implements the System Design Requirement (SDR v1.1), which was
written under the working name "SLBF" — the organisation is FBF.

Every content page is generated from the database and managed through the admin
panel — publishing requires no redeploy.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, React 19, Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, design tokens in `src/app/globals.css` |
| Database | Postgres (Neon on Vercel) via Prisma 7 and the `pg` driver adapter |
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
cp .env.example .env      # then fill in DATABASE_URL and TICKET_SECRET
npm run db:migrate        # create the schema
npm run db:seed           # load sectors, the forum, speakers, content
npm run dev
```

Open http://localhost:3000.

The seed creates four staff accounts and eight member accounts, all with the
password `FBFdev2026!`:

| Account | Role |
|---------|------|
| `admin@fbf.sl` | Administrator |
| `editor@fbf.sl` | Editor |
| `events@fbf.sl` | Event manager |
| `finance@fbf.sl` | Finance |

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

**Status columns** are `String` in the database rather than a native enum, so
that adding a status is a code change and not a migration that locks a table.
`src/lib/enums.ts` is the single source of truth for permitted values and
`src/lib/validation.ts` enforces them at runtime. Never write a bare string
literal to one.

**Permissions** are checked server-side on every protected action via
`src/lib/rbac.ts`. Hiding a link is not access control.

**Prices are never trusted from the browser.** Step 1 of registration shows an
estimate; the figure charged is always recomputed server-side from the ticket
type and promo code IDs.

## Status

Built and verified (`npm run build` and `npm run typecheck` both clean):

- Database schema, migrations and seed content
- Auth, RBAC, validation, pricing, QR ticketing, payment gateways, notifications,
  audit trail
- Design system, global header/footer, homepage (§4.2), error and 404 pages
- Public site: About, the forum (overview, agenda, speakers, sponsors, venue),
  Learning Hub, Blog, Contact, Membership, business directory, Deal Room,
  privacy and terms
- Registration flow (§4.9), payment webhooks and the sandbox checkout
- Membership application (§4.10) — creates a PENDING member and a draft
  directory entry; the account it opens has no usable password until activation
- Member / delegate portal (§4.16): sign in, forgotten and reset password,
  dashboard, e-tickets with QR, membership, directory listing management,
  payments and invoices, profile and password
- Admin panel (§12): dashboard queue, programme and speakers, registrations and
  check-in, payments, ledger, members with activation and invoicing, Deal Room
  review queues, enquiries, articles, users, settings, audit log
- Programme editing (§4.5, §4.6): sessions, tracks, speaker profiles and each
  session's line-up. A session's day is derived from its start date rather than
  typed, so the agenda's day tabs cannot disagree with the dates under them
- Forum editing (§4.4): each edition's dates, venue, objectives, brochure and
  prospectus, whether registration is open, and which forum the site promotes.
  Exactly one forum is current, and the flag is moved in a transaction rather
  than left to whoever saves next. Forums are never deleted — they are the
  parent of paid registrations and of an append-only ledger — so unpublishing
  is the only removal offered
- Media collections (§4.14): the collections the homepage gallery, the film
  band, the recordings page and the downloads page read, and the files in them.
  A file is stored as an *address* — a path under `public/`, a file in the blob
  store, or a link to the platform holding it — and the local/remote
  distinction is what decides whether a film plays in place or is linked out.
  An asset's kind follows its collection, and its type and size are read from
  the file rather than typed
- File uploads (§4.14): where a Vercel Blob store is attached
  (`BLOB_READ_WRITE_TOKEN`), the media library, the article and speaker forms,
  the forum form and the page editor each offer a file picker beside their
  address field. The file goes from the editor's browser straight to the store
  — a serverless function may only take about 4.5 MB of request body, which is
  smaller than the files most worth uploading — and only the resulting address
  is posted back, so nothing downstream of the address changed. With no store
  attached the pickers are not rendered and staff paste an address, which is
  still how anything already hosted elsewhere gets onto the site
- Page copy across the whole public site (§15, FR-01): every heading, eyebrow,
  standfirst, empty-state message and button label on the public pages is a
  block in the page editor. The wording in each route file is kept as a
  *fallback*, so an unwritten or unpublished block leaves the page reading
  exactly as it always has rather than leaving a hole — `getPageCopy` in
  `src/lib/settings.ts` is the whole contract, and `src/lib/cms-pages.ts`
  declares which keys each page has
- Self-hosted video (§4.14): the homepage film band and the recordings page.
  A `/`-relative asset URL is a file this site serves and is played in place;
  anything else is a recording on a platform and is linked out to its host.
  Nothing is fetched until the player is scrolled to

Not yet built:

- Ticket types, promo codes and sponsors — seeded, and editable only in the
  database
- The header and footer navigation labels, which name routes rather than being
  editorial, and the leadership, partner and sector *records* themselves, which
  are seeded. The wording around all of them is editable; the rows are not
- Refunds (the ledger is append-only, so a refund is its own action, not an
  undo of a settlement)

## Deployment

Set every variable in `.env.example` in the host environment. In production:

- `PAYMENTS_MODE=live` requires all gateway credentials — the app refuses to
  start without them rather than accepting registrations it cannot collect.
- `TICKET_SECRET` must be stable for the life of an event — rotating it
  invalidates every e-ticket already issued.
- `NEXT_PUBLIC_SITE_URL` must be the real public origin. It is baked into QR
  ticket links and canonical tags, so a preview URL left here sends delegates
  and search engines to a deployment that will later be replaced.

### Vercel

The app is deployed from this repository. Vercel's filesystem is ephemeral and
read-only, which is the whole reason the database is Postgres rather than a
file — and the same reason an uploaded file goes to a Blob store rather than to
`public/` (see `src/lib/uploads.ts`). The media library still stores
*references* either way; an upload simply produces one.

**First deployment, in order.** The order matters: the build runs
`prisma migrate deploy`, so the database has to exist before the first build.

1. **Create the database.** In the Vercel dashboard, *Storage → Create
   Database → Neon*. Choose a region near both the audience and the functions
   (`eu-west-2` / London for Sierra Leone). Connecting it to the project adds
   `DATABASE_URL` automatically.
2. **Use the pooled connection string.** Confirm the `DATABASE_URL` Vercel
   added contains `-pooler`. Each serverless instance opens its own pool, so
   the direct endpoint exhausts connections as soon as traffic spreads across
   instances. `src/lib/db.ts` caps each pool at one connection for the same
   reason.
3. **Import the repository.** *Add New → Project*, pick this repo. The
   framework preset and build command are detected; nothing needs overriding.
4. **Add the remaining environment variables** from `.env.example` — at minimum
   `TICKET_SECRET` (`openssl rand -base64 48`) and `NEXT_PUBLIC_SITE_URL`.
   `PAYMENTS_MODE=sandbox` and `MAIL_MODE=log` are the safe defaults until the
   gateway credentials exist; `src/lib/env.ts` refuses to boot on a half-
   configured `live`.
5. **Deploy**, then **seed once** from a machine with the same connection
   string: `DATABASE_URL="<pooled url>" npm run db:seed`. Every page reads its
   content from the database, so an unseeded deployment renders an empty site
   rather than a broken one. The seed is idempotent and safe to re-run.
6. **Change the seeded passwords.** The seed's accounts share a published
   password (see *Getting started*) and are development fixtures, not staff
   credentials.
7. **Create the Blob store**, if staff are to upload files rather than paste
   addresses. *Storage → Create → Blob*, then connect it to the project;
   Vercel adds `BLOB_READ_WRITE_TOKEN` itself and the next deployment picks it
   up. This step is genuinely optional and can be done at any time — the admin
   panel renders the file pickers only when the token is present, so nothing
   breaks before it and nothing needs changing after it.

Later deployments need none of this: pushing to the default branch runs
`prisma migrate deploy` and then the build, so a committed migration is applied
before the code that depends on it serves a request.

**Regions.** Set the function region to match the database region
(*Settings → Functions*). A function in Washington querying a database in
London pays that round trip on every query, and these pages issue several.

**Preview deployments** inherit the same `DATABASE_URL` unless you scope the
variable to Production. Until you do, a preview branch carrying a new migration
will migrate the production database when it builds.
