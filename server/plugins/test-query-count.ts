import { queryCounter } from '../utils/prisma'

// Query-count seam (issue #45). After the handler runs, expose the number of
// Prisma queries it issued via the `x-query-count` response header so e2e tests
// can assert bounds (e.g. topRiders must issue ≤ 2 queries, not N+1). Paired
// with the zz-test-query-count middleware that resets the counter per request.
// No-op in production (TEST_HOOKS unset).
export default defineNitroPlugin((nitro) => {
  if (process.env.TEST_HOOKS !== '1') return
  nitro.hooks.hook('beforeResponse', (event) => {
    if (getHeader(event, 'x-test-count-queries')) {
      setResponseHeader(event, 'x-query-count', String(queryCounter.count))
    }
  })
})
