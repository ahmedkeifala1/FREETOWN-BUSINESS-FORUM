import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

/**
 * Prisma 7 requires a driver adapter rather than a datasource URL in the
 * schema. Swapping SQLite for Postgres in production is a change of adapter
 * here plus the `provider` in prisma/schema.prisma — no query code changes.
 *
 * The client is cached on globalThis so Next.js's dev-mode module reloading
 * does not open a new connection pool on every edit.
 */

const createClient = () =>
  new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
    }),
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
