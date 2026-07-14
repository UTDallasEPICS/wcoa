import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared, fetchWithQueryCount } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Regression test for issue #24: the topRiders metric endpoint did a groupBy
// followed by one prisma.client.findUnique PER grouped client (a classic N+1).
// The fix batches those lookups into a single findMany, so the whole handler
// runs in <= 2 Prisma queries (groupBy + findMany) and the output shape/order
// is unchanged.
//
// Query count is pinned via the query-count seam (issue #45): pre-fix the
// handler ran groupBy + N findUnique (> 2); post-fix it stays <= 2.
//
// Output correctness is proven against data this test creates itself, in a
// far-future date window with dedicated clients, so it is immune to the shared
// e2e server's concurrent mutations of the seeded rides.

interface TopRider {
  name: string
  completedRides: number
}

type Client = { id: string; user: { email: string } }
type Ride = { id: string; status: string }

// A ride far in the future so it never overlaps the seeded rides or rides other
// e2e files create; the query below restricts to exactly this window.
const WINDOW_START = '2090-01-01'
const WINDOW_END = '2090-12-31'
const SCHEDULED_DAY = '2090-06-15'

const testAddress = {
  street: '742 Evergreen Terrace',
  city: 'Springfield',
  state: 'TX',
  zip: '75001',
}

async function completeRideFor(cookie: string, clientId: string): Promise<void> {
  const created = await $fetch<Ride>('/api/post/rides', {
    method: 'POST',
    headers: { cookie },
    body: {
      clientId,
      pickup: testAddress,
      dropoff: testAddress,
      scheduledTime: `${SCHEDULED_DAY}T14:00:00`,
    },
  })
  const completed = await $fetch<Ride>(`/api/put/rides/${created.id}`, {
    method: 'PUT',
    headers: { cookie },
    body: { status: 'COMPLETED', totalRideTime: 1 },
  })
  expect(completed.status).toBe('COMPLETED')
}

describe('topRiders N+1 (issue #24)', () => {
  it('resolves grouped clients in a single batched query (<= 2 total)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const { status, queryCount } = await fetchWithQueryCount(
      '/api/get/metrics/topRiders',
      { headers: { cookie } },
    )
    expect(status).toBe(200)
    // groupBy + one batched findMany == 2. Anything more means the per-client
    // findUnique loop (N+1) is still present.
    expect(queryCount).toBeLessThanOrEqual(2)
  })

  it('returns real client names + correct counts, ordered desc (batching unchanged)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const { items: clients } = await $fetch<{ items: Client[] }>('/api/get/clients?pageSize=100', {
      headers: { cookie },
    })
    const [clientA, clientB] = clients
    expect(clientA, 'seed should provide at least two clients').toBeTruthy()
    expect(clientB, 'seed should provide at least two clients').toBeTruthy()

    const nameOf = (email: string) =>
      ({
        'martha@example.com': 'Martha Jenkins',
        'george@example.com': 'George Miller',
        'sarah@example.com': 'Sarah Connor',
      })[email] ?? email

    // clientA gets two completed rides, clientB gets one — in an isolated window.
    await completeRideFor(cookie, clientA!.id)
    await completeRideFor(cookie, clientA!.id)
    await completeRideFor(cookie, clientB!.id)

    const qs = `startDate=${WINDOW_START}&endDate=${WINDOW_END}`
    const { status, body } = await fetchWithQueryCount<TopRider[]>(
      `/api/get/metrics/topRiders?${qs}`,
      { headers: { cookie } },
    )
    expect(status).toBe(200)
    expect(Array.isArray(body)).toBe(true)

    // Only our two clients have completed rides in this window. Names must be
    // resolved (never the 'Unknown' fallback) with the exact counts, and the
    // higher-count client must come first (desc ordering preserved by the map).
    expect(body).toEqual([
      { name: nameOf(clientA!.user.email), completedRides: 2 },
      { name: nameOf(clientB!.user.email), completedRides: 1 },
    ])
  })
})
