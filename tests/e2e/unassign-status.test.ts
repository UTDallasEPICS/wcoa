import { afterEach, describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { loginAs } from '../utils/auth'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
})

type Ride = {
  id: string
  status: 'CREATED' | 'ASSIGNED' | 'COMPLETED'
  volunteerId: string | null
}

async function getRides(cookie: string): Promise<Ride[]> {
  return await $fetch<Ride[]>('/api/get/rides', { headers: { cookie } })
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
    // Directly reset to CREATED/unassigned (bypass the auto-CREATED behavior by
    // sending an explicit status alongside the cleared volunteer).
    await put(cookie, id, { volunteerId: '', status: 'CREATED' })
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
    })

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
