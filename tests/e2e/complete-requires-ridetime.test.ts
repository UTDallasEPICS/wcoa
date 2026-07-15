import { afterEach, describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

type Ride = {
  id: string
  status: 'CREATED' | 'ASSIGNED' | 'COMPLETED'
  volunteerId: string | null
  totalRideTime: number | null
}

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

async function aVolunteerId(cookie: string): Promise<string> {
  const withVolunteer = (await getRides(cookie)).find((r) => r.volunteerId)
  expect(withVolunteer, 'seed should have a ride with a volunteer').toBeTruthy()
  return withVolunteer!.volunteerId!
}

// Rides this file mutated; reset to CREATED/unassigned after each test so the
// shared seed DB (used by other e2e files) stays intact.
const touchedRideIds = new Set<string>()

async function freshAssignedRide(cookie: string): Promise<Ride> {
  const created = (await getRides(cookie)).find(
    (r) => r.status === 'CREATED' && !touchedRideIds.has(r.id),
  )
  expect(created, 'seed should have an untouched CREATED ride').toBeTruthy()
  touchedRideIds.add(created!.id)
  const volunteerId = await aVolunteerId(cookie)
  const ride = await put(cookie, created!.id, { volunteerId, status: 'ASSIGNED' })
  expect(ride.status).toBe('ASSIGNED')
  return ride
}

afterEach(async () => {
  if (!touchedRideIds.size) return
  const cookie = await loginAs('reachtusharwani@gmail.com')
  for (const id of touchedRideIds) {
    // Best-effort reset via non-throwing appFetch: since #95, a COMPLETED ride
    // is terminal and its status can no longer be changed back to CREATED (that
    // returns 409). A ride left COMPLETED here is harmless — the seed DB is
    // reset per-file and each test picks its own untouched CREATED ride.
    await appFetch(`/api/put/rides/${id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ volunteerId: '', status: 'CREATED' }),
    })
  }
  touchedRideIds.clear()
})

describe('PUT /api/put/rides/[id] — completing a ride requires totalRideTime (issue #10)', () => {
  it('rejects COMPLETED with no totalRideTime (400) and does not complete the ride', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    // Pre-fix this returned 200 and marked the ride COMPLETED with null hours,
    // yielding "Total Time: N/A" in the admin email and skewing metrics (#18).
    await expect(put(cookie, assigned.id, { status: 'COMPLETED' })).rejects.toMatchObject({
      statusCode: 400,
    })

    // The ride must NOT have been completed.
    const after = (await getRides(cookie)).find((r) => r.id === assigned.id)
    expect(after!.status).toBe('ASSIGNED')
  })

  it('rejects COMPLETED with a totalRideTime below 0.1 (400)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    await expect(
      put(cookie, assigned.id, { status: 'COMPLETED', totalRideTime: 0 }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('accepts COMPLETED with a valid totalRideTime (200)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    const updated = await put(cookie, assigned.id, {
      status: 'COMPLETED',
      totalRideTime: 1.5,
    })

    expect(updated.status).toBe('COMPLETED')
    expect(updated.totalRideTime).toBe(1.5)
  })

  it('allows re-updating an already-completed ride without re-sending totalRideTime', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    const completed = await put(cookie, assigned.id, {
      status: 'COMPLETED',
      totalRideTime: 2,
    })
    expect(completed.status).toBe('COMPLETED')

    // Re-sending COMPLETED (e.g. editing notes) with no totalRideTime succeeds
    // because the existing ride already has a valid stored duration.
    const edited = await put(cookie, assigned.id, {
      status: 'COMPLETED',
      notes: 'edited after completion',
    })
    expect(edited.status).toBe('COMPLETED')
    expect(edited.totalRideTime).toBe(2)
  })
})
