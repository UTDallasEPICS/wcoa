import { queryCounter } from '../utils/prisma'

// Query-count seam (issue #45). Resets the per-request query counter so an e2e
// test can measure only the handler's queries. Named `zz-` so it runs AFTER
// `auth.ts` (Nitro runs middleware in alphabetical order) — the auth session
// lookup's queries happen first and are excluded from the count. No-op unless
// TEST_HOOKS=1 and the request opts in with `x-test-count-queries`.
export default defineEventHandler((event) => {
  if (process.env.TEST_HOOKS !== '1') return
  if (getHeader(event, 'x-test-count-queries')) {
    queryCounter.count = 0
  }
})
