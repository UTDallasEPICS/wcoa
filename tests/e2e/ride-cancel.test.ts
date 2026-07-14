import { afterEach, describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

type Ride = {
  id: string
  status: 'CREATED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'
  volunteerId: string | null
}

async function getRides(cookie: string): Promise<Ride[]> {
  // /api/get/rides is paginated (issue #13); pageSize=100 fetches the full set.
  const res = await $fetch<{ items: Ride[] }>('/api/get/rides?pageSize=100', {
    headers: { cookie },
  })
  return res.items
}

async function getRideById(cookie: string, id: string): Promise<Ride> {
  return await $fetch<Ride>(`/api/get/rides/byId/${id}`, { headers: { cookie } })
}

// Rides mutated here are restored to CREATED after each test so the shared seed
// DB (used by other e2e files) stays intact.
const touchedRideIds = new Set<string>()

async function anUntouchedCreatedRide(cookie: string): Promise<Ride> {
  const created = (await getRides(cookie)).find(
    (r) => r.status === 'CREATED' && !touchedRideIds.has(r.id),
  )
  expect(created, 'seed should have an untouched CREATED ride').toBeTruthy()
  touchedRideIds.add(created!.id)
  return created!
}

afterEach(async () => {
  if (!touchedRideIds.size) return
  const cookie = await loginAs('reachtusharwani@gmail.com')
  for (const id of touchedRideIds) {
    await appFetch(`/api/put/rides/${id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ volunteerId: '', status: 'CREATED' }),
    })
  }
  touchedRideIds.clear()
})

describe('PUT /api/put/rides/[id] — ride cancellation (issue #5)', () => {
  it('accepts status: CANCELLED (200) and persists it', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const ride = await anUntouchedCreatedRide(cookie)

    // Pre-fix, the zod schema only allowed CREATED|ASSIGNED|COMPLETED, so this
    // returned 400 and the status was never persisted.
    const res = await appFetch(`/api/put/rides/${ride.id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    })

    expect(res.status).toBe(200)

    // Persisted: GET it back and confirm the stored status is CANCELLED.
    const fetched = await getRideById(cookie, ride.id)
    expect(fetched.status).toBe('CANCELLED')
  })

  it('cancelling an ASSIGNED ride keeps the volunteer and fires the RIDE_CANCELLED path', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const ride = await anUntouchedCreatedRide(cookie)

    // Assign a volunteer first so the RIDE_CANCELLED notification branch (which
    // notifies the previously-assigned volunteer) is exercised.
    const withVolunteer = (await getRides(cookie)).find((r) => r.volunteerId)
    expect(withVolunteer, 'seed should have a ride with a volunteer').toBeTruthy()
    const volunteerId = withVolunteer!.volunteerId!

    const assigned = await $fetch<Ride>(`/api/put/rides/${ride.id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: { volunteerId, status: 'ASSIGNED' },
    })
    expect(assigned.status).toBe('ASSIGNED')

    // Cancel it. The handler runs sendNotification('RIDE_CANCELLED', ...) inline;
    // email sends are swallowed in the test env, so we assert the observable
    // outcome — a 200 and the persisted CANCELLED status.
    const cancelled = await $fetch<Ride>(`/api/put/rides/${ride.id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: { status: 'CANCELLED' },
    })

    expect(cancelled.status).toBe('CANCELLED')
    expect(cancelled.volunteerId).toBe(volunteerId)
  })
})
