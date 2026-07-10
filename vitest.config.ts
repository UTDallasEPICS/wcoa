import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const testDb = fileURLToPath(new URL('./.data/test.db', import.meta.url))

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    // Reset the shared SQLite DB to its seed snapshot before every test file so
    // the suite is order-independent (issue #62). Runs once per worker/file.
    setupFiles: ['tests/setup-reset-db.ts'],
    // The e2e suite boots one Nuxt server against one shared SQLite file,
    // so test files must not run in parallel.
    fileParallelism: false,
    pool: 'forks',
    env: {
      DATABASE_URL: `file:${testDb}`,
      BETTER_AUTH_SECRET: 'test-secret-not-for-production',
      DISABLE_RATE_LIMIT: 'true',
    },
    testTimeout: 30_000,
    // First hook builds the Nuxt app; allow plenty of time.
    hookTimeout: 300_000,
  },
})
