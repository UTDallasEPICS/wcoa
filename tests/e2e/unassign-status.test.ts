import { afterEach, describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

type Ride = {
  id: string
  status: 'CREATED' | 'ASSIGNED' | 'COMPLETED'
  volunteerId: string | null
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

// A volunteer id present in the seed data (some rides are seeded ASSIGNED).
async function aVolunteerId(cookie: string): Promise<string> {
  const withVolunteer = (await getRides(cookie)).find((r) => r.volunteerId)
  expect(withVolunteer, 'seed should have a ride with a volunteer').toBeTruthy()
  return withVolunteer!.volunteerId!
}

// Rides this file mutated; restored to CREATED/unassigned after each test so the
// shared seed DB (used by other e2e files, e.g. pii-scoping) stays intact.
const touchedRideIds = new Set<string>()

// Set up a fresh ASSIGNED ride for a test by assigning a volunteer to a
// CREATED ride. Self-contained so tests don't depend on run order or on the
// finite pool of seeded ASSIGNED rides.
async function freshAssignedRide(cookie: string): Promise<Ride> {
  const created = (await getRides(cookie)).find(
    (r) => r.status === 'CREATED' && !touchedRideIds.has(r.id),
  )
  expect(created, 'seed should have an untouched CREATED ride').toBeTruthy()
  touchedRideIds.add(created!.id)
  const volunteerId = await aVolunteerId(cookie)
  const ride = await put(cookie, created!.id, { volunteerId, status: 'ASSIGNED' })
  expect(ride.status).toBe('ASSIGNED')
  expect(ride.volunteerId).toBe(volunteerId)
  return ride
}

afterEach(async () => {
  if (!touchedRideIds.size) return
  const cookie = await loginAs('reachtusharwani@gmail.com')
  for (const id of touchedRideIds) {
    // Best-effort reset to CREATED/unassigned via non-throwing appFetch. Since
    // #95 a COMPLETED ride is terminal, so this reset is a no-op (409) for a
    // ride a test left COMPLETED — harmless, since the seed DB is reset per-file
    // and every test picks its own untouched CREATED ride.
    await appFetch(`/api/put/rides/${id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ volunteerId: '', status: 'CREATED' }),
    })
  }
  touchedRideIds.clear()
})

describe('PUT /api/put/rides/[id] — unassigning a volunteer (issue #7)', () => {
  it('resets an ASSIGNED ride to CREATED when the volunteer is cleared', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    const updated = await put(cookie, assigned.id, { volunteerId: '' })

    // Bug #7: previously the ride stayed ASSIGNED with volunteerId=null (a stuck
    // state). It must return to the available pool.
    expect(updated.volunteerId).toBeNull()
    expect(updated.status).toBe('CREATED')
  })

  it('respects an explicit status when unassigning (does not force CREATED)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    const updated = await put(cookie, assigned.id, {
      volunteerId: '',
      status: 'COMPLETED',
      // totalRideTime required to complete (issue #10); the #7 behavior under
      // test here is the status/volunteer handling, not the duration check.
      totalRideTime: 1.5,
    })

    expect(updated.volunteerId).toBeNull()
    expect(updated.status).toBe('COMPLETED')
  })

  it('does NOT un-complete a COMPLETED ride when the volunteer is cleared', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    // Complete the ride (as the mark-complete flow would).
    const completed = await put(cookie, assigned.id, {
      status: 'COMPLETED',
      totalRideTime: 1.5,
    })
    expect(completed.status).toBe('COMPLETED')

    // Clearing the volunteer with no explicit status must NOT silently flip a
    // COMPLETED ride back to CREATED — that would drop it from completion
    // metrics while leaving its totalRideTime (issue #7 hardening).
    const updated = await put(cookie, assigned.id, { volunteerId: '' })

    expect(updated.volunteerId).toBeNull()
    expect(updated.status).toBe('COMPLETED')
  })

  it('leaves status untouched on an edit that does not change the volunteer', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const assigned = await freshAssignedRide(cookie)

    const updated = await put(cookie, assigned.id, {
      notes: 'edited note, volunteer unchanged',
    })

    expect(updated.status).toBe('ASSIGNED')
    expect(updated.volunteerId).toBe(assigned.volunteerId)
  })

  it('assigning a volunteer still works', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const created = (await getRides(cookie)).find(
      (r) => r.status === 'CREATED' && !touchedRideIds.has(r.id),
    )
    expect(created).toBeTruthy()
    touchedRideIds.add(created!.id)
    const volunteerId = await aVolunteerId(cookie)

    const updated = await put(cookie, created!.id, {
      volunteerId,
      status: 'ASSIGNED',
    })

    expect(updated.volunteerId).toBe(volunteerId)
    expect(updated.status).toBe('ASSIGNED')
  })
})
