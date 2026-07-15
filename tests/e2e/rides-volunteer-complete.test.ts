import { afterEach, describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

type Ride = {
  id: string
  status: 'CREATED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'
  volunteerId: string | null
  totalRideTime: number | null
  volunteer: { userId: string; user: { email: string } } | null
}

const ADMIN = 'reachtusharwani@gmail.com'
const BOB = 'bob@example.com'
const ALICE = 'alice@example.com'

async function getRides(cookie: string): Promise<Ride[]> {
  // /api/get/rides is paginated (issue #13); pageSize=100 fetches the full set.
  const res = await $fetch<{ items: Ride[] }>('/api/get/rides?pageSize=100', {
    headers: { cookie },
  })
  return res.items
}

function put(cookie: string, id: string, body: Record<string, unknown>) {
  return $fetch<Ride>(`/api/put/rides/${id}`, {
    method: 'PUT',
    headers: { cookie },
    body,
  })
}

// Raw POST to the self-service complete endpoint so we can assert the exact
// status code — including the pre-fix 403 the global auth middleware returns for
// a volunteer POST outside VOLUNTEER_WRITE_ALLOW (appFetch does not throw on
// non-2xx the way $fetch does).
function postComplete(cookie: string, id: string, body: Record<string, unknown>) {
  return appFetch(`/api/post/rides/${id}/complete`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function volunteerIdByEmail(adminCookie: string, email: string): Promise<string> {
  // The admin ride listing includes volunteer.user, so we can resolve a
  // volunteer's id from any ride they are attached to without hard-coding ids.
  const match = (await getRides(adminCookie)).find((r) => r.volunteer?.user?.email === email)
  expect(match, `seed should have a ride whose volunteer is ${email}`).toBeTruthy()
  return match!.volunteerId!
}

// Rides this file mutated; restored to CREATED/unassigned after each test so a
// COMPLETED/ASSIGNED ride from one `it` can't leak into the next (the seed DB is
// reset per-file, not per-test).
const touchedRideIds = new Set<string>()

// Assign a fresh, untouched CREATED ride to the given volunteer and return its
// id, so each destructive test operates on its own ride.
async function freshAssignedRideFor(adminCookie: string, volunteerId: string): Promise<string> {
  const created = (await getRides(adminCookie)).find(
    (r) => r.status === 'CREATED' && !touchedRideIds.has(r.id),
  )
  expect(created, 'seed should have an untouched CREATED ride').toBeTruthy()
  touchedRideIds.add(created!.id)
  const assigned = await put(adminCookie, created!.id, { volunteerId, status: 'ASSIGNED' })
  expect(assigned.status).toBe('ASSIGNED')
  return created!.id
}

afterEach(async () => {
  if (!touchedRideIds.size) return
  const cookie = await loginAs(ADMIN)
  for (const id of touchedRideIds) {
    // Best-effort reset via non-throwing appFetch: since #95 a COMPLETED ride is
    // terminal and can't be reset to CREATED (409). A ride left COMPLETED is
    // harmless — the seed DB is reset per-file and each test picks its own
    // untouched CREATED ride.
    await appFetch(`/api/put/rides/${id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ volunteerId: '', status: 'CREATED' }),
    })
  }
  touchedRideIds.clear()
})

describe('POST /api/post/rides/[id]/complete — volunteers can complete their own rides (issue #87)', () => {
  it('lets the assigned volunteer complete their ride (200) and persists COMPLETED + totalRideTime', async () => {
    const adminCookie = await loginAs(ADMIN)
    const bobVolId = await volunteerIdByEmail(adminCookie, BOB)
    const rideId = await freshAssignedRideFor(adminCookie, bobVolId)

    // Headline. Pre-fix this endpoint does not exist AND the global auth
    // middleware 403s any volunteer POST outside VOLUNTEER_WRITE_ALLOW, so this
    // returned 403 "Admin access required" and the ride stayed ASSIGNED.
    const bobCookie = await loginAs(BOB)
    const res = await postComplete(bobCookie, rideId, { totalRideTime: 1.5 })
    expect(res.status).toBe(200)

    const after = (await getRides(adminCookie)).find((r) => r.id === rideId)
    expect(after!.status).toBe('COMPLETED')
    expect(after!.totalRideTime).toBe(1.5)
  })

  it('rejects a volunteer completing a ride assigned to a different volunteer (alice) — 403/404, ride not completed', async () => {
    const adminCookie = await loginAs(ADMIN)
    const aliceVolId = await volunteerIdByEmail(adminCookie, ALICE)
    const rideId = await freshAssignedRideFor(adminCookie, aliceVolId)

    // Bob is not the assigned volunteer, so even a well-formed request must be
    // rejected on ownership grounds — the ride must NOT be completed.
    const bobCookie = await loginAs(BOB)
    const res = await postComplete(bobCookie, rideId, { totalRideTime: 1.5 })
    expect([403, 404]).toContain(res.status)

    const after = (await getRides(adminCookie)).find((r) => r.id === rideId)
    expect(after!.status).toBe('ASSIGNED')
  })

  it('rejects completion with missing or zero totalRideTime (400 — mirrors the issue #10 guard), ride not completed', async () => {
    const adminCookie = await loginAs(ADMIN)
    const bobVolId = await volunteerIdByEmail(adminCookie, BOB)
    const rideId = await freshAssignedRideFor(adminCookie, bobVolId)

    // Owner (bob) but bogus duration: the #10 guard must reject it so a ride
    // can't be completed with null/zero hours (which skews the hours metrics).
    const bobCookie = await loginAs(BOB)
    const missing = await postComplete(bobCookie, rideId, {})
    expect(missing.status).toBe(400)
    const zero = await postComplete(bobCookie, rideId, { totalRideTime: 0 })
    expect(zero.status).toBe(400)

    const after = (await getRides(adminCookie)).find((r) => r.id === rideId)
    expect(after!.status).toBe('ASSIGNED')
  })

  it('non-regression: an admin can still complete a ride via PUT /api/put/rides/[id]', async () => {
    const adminCookie = await loginAs(ADMIN)
    const bobVolId = await volunteerIdByEmail(adminCookie, BOB)
    const rideId = await freshAssignedRideFor(adminCookie, bobVolId)

    const updated = await put(adminCookie, rideId, { status: 'COMPLETED', totalRideTime: 2 })
    expect(updated.status).toBe('COMPLETED')
    expect(updated.totalRideTime).toBe(2)
  })
})
