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
    const { status, queryCount, body } = await fetchWithQueryCount<{ items: unknown[] }>(
      '/api/get/rides',
      { headers: { cookie } }
    )
    expect(status).toBe(200)
    // Seed has 9+ rides each with nested client/volunteer includes. Prisma loads
    // includes per-relation-level (a small constant), NOT per row — so the count
    // must stay bounded regardless of how many rides exist. Pagination (issue
    // #13) adds one count() query alongside the findMany. A per-row N+1 here
    // would blow past this.
    expect(Array.isArray(body.items)).toBe(true)
    expect(queryCount).toBeLessThanOrEqual(6)
  })

  it('keeps topRiders batched (issue #24): groupBy + one findMany, not an N+1', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const { status, queryCount } = await fetchWithQueryCount('/api/get/metrics/topRiders', {
      headers: { cookie },
    })
    expect(status).toBe(200)
    // topRiders does groupBy + a single batched findMany for the grouped clients
    // (issue #24 fix). Previously it ran one findUnique PER grouped client (N+1,
    // > 2 queries with the seeded COMPLETED rides). The batched version stays at
    // <= 2 regardless of how many clients are returned.
    expect(queryCount).toBeLessThanOrEqual(2)
  })

  it('is opt-in: no x-query-count header without the request opt-in', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const res = await appFetch('/api/get/addresses?search=a', { headers: { cookie } })
    expect(res.headers.get('x-query-count')).toBeNull()
  })
})
