import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Prisma 7 requires a driver adapter rather than a datasource URL in the
 * schema, so the connection is configured here and the `provider` in
 * prisma/schema.prisma has to agree with it.
 *
 * The client is cached on globalThis so Next.js's dev-mode module reloading
 * does not open a new connection pool on every edit.
 */

const createClient = () => {
  const url = process.env.DATABASE_URL

  // No fallback on purpose: a default connection string would turn a missing
  // DATABASE_URL into a confusing connection error at the first query rather
  // than a plain statement of what is wrong, on the deployment where it is
  // hardest to diagnose.
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env for local development.',
    )
  }

  return new PrismaClient({
    /**
     * `max: 1` because each serverless instance handles one request at a time
     * and every instance holds its own pool — a larger per-instance pool does
     * not raise throughput, it just multiplies idle connections by the number
     * of instances until the database refuses new ones. Concurrency across
     * instances is what the host's pooled connection string is for, so
     * DATABASE_URL must point at the pooler and not at the direct endpoint.
     */
    adapter: new PrismaPg({ connectionString: url, max: 1 }),
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
