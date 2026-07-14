import { defineConfig } from '@playwright/test'

// Browser-flow suite (REQUIREMENTS.md §14). Runs real user flows — OTP login,
// ride lifecycle, people management, settings — against the production build
// with a throwaway seeded DB (scripts/browser-server.mjs).
//
//   pnpm test:browser
//
// Single worker on purpose: the specs share one seeded DB and mutate it.
export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3210',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/browser-server.mjs',
    url: 'http://localhost:3210/auth',
    reuseExistingServer: !process.env.CI,
    // First run may include a full nuxt build.
    timeout: 300_000,
  },
})
