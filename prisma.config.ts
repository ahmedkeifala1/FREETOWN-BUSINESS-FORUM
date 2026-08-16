import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

/**
 * Prisma 7 reads datasource and migration settings from here rather than from
 * the schema file. `dotenv/config` is imported because the Prisma CLI, unlike
 * the Next.js runtime, does not load `.env` on its own.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
