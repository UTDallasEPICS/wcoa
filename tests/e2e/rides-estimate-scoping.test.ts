import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #93 (sibling of #41): GET /api/get/rides/estimate/[id] did a bare
// findFirst({ id, deletedAt: null }) with no session/role check, so any
// authenticated volunteer could read ANY ride's cached estimate — and trigger a
// billable Google Directions call on a cache miss — for rides that aren't theirs.
// get/rides/byId/[id] already 404s in that case (#41); the estimate endpoint
// must apply the same record-level scoping: a non-admin may only reach a ride
// that is available (CREATED) or assigned to them, else 404.

type Ride = {
  id: string
  status: string
  volunteer: { userId: string } | null
}

interface EstimateResponse {
  duration: string | null
  distance: string | null
  durationValue: number | null
  distanceValue: number | null
  error: string | null
}

// The harness runs maps offline (MAPS_OFFLINE=1) and no seeded ride has a cached
// estimate, so an *authorized* call falls through to the cache-miss branch,
// geocodes a canned point, fails to route (offline), and responds HTTP 200 with
// this sentinel. Asserting on it proves the caller cleared the scoping gate and
// reached the estimate computation (hermetically — no outbound call).
const MISS_ERROR = "Couldn't calculate a route for this trip."

async function allRides(cookie: string): Promise<Ride[]> {
  const { items } = await $fetch<{ items: Ride[] }>('/api/get/rides?pageSize=100', {
    headers: { cookie },
  })
  return items
}

describe('issue #93 — get/rides/estimate/[id] record scoping', () => {
  it("VOLUNTEER cannot read the estimate of another volunteer's non-available ride (404)", async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')
    const bobCookie = await loginAs('bob@example.com')
    const me = await $fetch<{ user: { id: string } }>('/api/get/volunteers/bySession', {
      headers: { cookie: bobCookie },
    })
    const myUserId = me.user.id

    // A ride that is NOT available (not CREATED) and belongs to someone else —
    // in the seed this is Alice's completed ride. byId already 404s here (#41).
    const foreign = (await allRides(adminCookie)).find(
      (r) => r.status !== 'CREATED' && r.volunteer && r.volunteer.userId !== myUserId
    )
    expect(foreign, 'seed should contain a ride owned by another volunteer').toBeTruthy()

    // Pre-fix this resolves with HTTP 200 (the cache-miss body) instead of
    // rejecting, so this assertion fails: the estimate leaks across volunteers.
    await expect(
      $fetch(`/api/get/rides/estimate/${foreign!.id}`, { headers: { cookie: bobCookie } })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('VOLUNTEER CAN read the estimate of their own assigned ride (200)', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')
    const bobCookie = await loginAs('bob@example.com')
    const me = await $fetch<{ user: { id: string } }>('/api/get/volunteers/bySession', {
      headers: { cookie: bobCookie },
    })
    const myUserId = me.user.id

    // Non-available AND mine, so the 200 is due to ownership, not availability.
    const mine = (await allRides(adminCookie)).find(
      (r) => r.status !== 'CREATED' && r.volunteer && r.volunteer.userId === myUserId
    )
    expect(mine, 'seed should contain a non-available ride assigned to Bob').toBeTruthy()

    const res = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${mine!.id}`, {
      headers: { cookie: bobCookie },
    })
    expect(res.error).toBe(MISS_ERROR)
  })

  it('VOLUNTEER CAN read the estimate of an available (CREATED) ride (200)', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')
    const bobCookie = await loginAs('bob@example.com')

    const available = (await allRides(adminCookie)).find((r) => r.status === 'CREATED')
    expect(available, 'seed should contain an available ride').toBeTruthy()

    const res = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${available!.id}`, {
      headers: { cookie: bobCookie },
    })
    expect(res.error).toBe(MISS_ERROR)
  })

  it('ADMIN can read the estimate of any ride (200)', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')
    const bobCookie = await loginAs('bob@example.com')
    const me = await $fetch<{ user: { id: string } }>('/api/get/volunteers/bySession', {
      headers: { cookie: bobCookie },
    })
    const myUserId = me.user.id

    // The same foreign ride Bob is denied above — admins are unscoped.
    const foreign = (await allRides(adminCookie)).find(
      (r) => r.status !== 'CREATED' && r.volunteer && r.volunteer.userId !== myUserId
    )
    expect(foreign).toBeTruthy()

    const res = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${foreign!.id}`, {
      headers: { cookie: adminCookie },
    })
    expect(res.error).toBe(MISS_ERROR)
  })
})
