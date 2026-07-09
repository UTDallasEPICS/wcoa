import { describe, expect, it } from 'vitest'
import { fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared, fetchWithQueryCount } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Validates the query-count seam (issue #45): a test-only per-request Prisma
// query counter, exposed via the x-query-count header, that lets e2e tests pin
// N+1 / unbounded-query regressions. Auth's own session-lookup queries are
// excluded (the reset middleware runs after auth.ts).

describe('query-count seam (#45)', () => {
  it('counts exactly the queries a handler runs (addresses = 1 findMany)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const { status, queryCount } = await fetchWithQueryCount('/api/get/addresses?search=a', {
      headers: { cookie },
    })
    expect(status).toBe(200)
    // The handler does a single prisma.address.findMany; auth queries are reset out.
    expect(queryCount).toBe(1)
  })

  it('stays bounded (not proportional to row count) for a batched list with includes', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const { status, queryCount, body } = await fetchWithQueryCount<unknown[]>('/api/get/rides', {
      headers: { cookie },
    })
    expect(status).toBe(200)
    // Seed has 9+ rides each with nested client/volunteer includes. Prisma loads
    // includes per-relation-level (a small constant), NOT per row — so the count
    // must stay bounded regardless of how many rides exist. A per-row N+1 here
    // would blow past this.
    expect(Array.isArray(body)).toBe(true)
    expect(queryCount).toBeLessThanOrEqual(5)
  })

  it('detects the topRiders N+1 (issue #24): more queries than a batched version would need', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const { status, queryCount } = await fetchWithQueryCount('/api/get/metrics/topRiders', {
      headers: { cookie },
    })
    expect(status).toBe(200)
    // topRiders currently does groupBy + one findUnique PER grouped client (N+1).
    // With the seeded COMPLETED rides that is > 2 queries. The batched fix (#24)
    // will bring this to <= 2 — at which point this assertion should be tightened
    // to `toBeLessThanOrEqual(2)`. Proves the seam catches a real N+1.
    expect(queryCount).toBeGreaterThan(2)
  })

  it('is opt-in: no x-query-count header without the request opt-in', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const res = await appFetch('/api/get/addresses?search=a', { headers: { cookie } })
    expect(res.headers.get('x-query-count')).toBeNull()
  })
})
