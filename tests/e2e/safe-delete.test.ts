import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { loginAs } from '../utils/auth'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
})

// Issue #23: deleting a Client who has rides used to throw P2003 (the
// ride->client FK is ON DELETE RESTRICT) and return a 500, so the admin UI
// delete failed. Deleting a client must never crash and must never destroy
// historical ride data — it should be blocked with a clear 409 while rides
// exist. Deleting a client with no rides still succeeds.
//
// It also covers the volunteer side of the same note: after a volunteer is
// deleted, their rides (volunteerId set to null by the FK) must not stay stuck
// in ASSIGNED — they should be reset to CREATED.

type Ride = {
  id: string
  status: string
  clientId: string
  volunteerId: string | null
}
type ClientRow = { id: string; user: { email: string | null } }
type VolunteerRow = { id: string; user: { email: string | null } }

describe('safe deletes (#23)', () => {
  it('does not crash (500) when deleting a client with rides — blocks with 409 and preserves data', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    const clients = await $fetch<ClientRow[]>('/api/get/clients', { headers: { cookie } })
    const ridesBefore = await $fetch<Ride[]>('/api/get/rides', { headers: { cookie } })

    // martha is seeded with rides.
    const martha = clients.find((c) => c.user.email === 'martha@example.com')
    expect(martha, 'martha should be seeded').toBeTruthy()
    const marthaRides = ridesBefore.filter((r) => r.clientId === martha!.id)
    expect(marthaRides.length, 'martha should have at least one ride').toBeGreaterThan(0)

    const res = await appFetch(`/api/delete/clients/${martha!.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    // Pre-fix this is a 500 (P2003). Post-fix it is a clean 409 block.
    expect(res.status, 'deleting a client with rides must not 500').not.toBe(500)
    expect(res.status).toBe(409)

    // Data preserved: the client and their rides still exist.
    const clientsAfter = await $fetch<ClientRow[]>('/api/get/clients', { headers: { cookie } })
    expect(clientsAfter.some((c) => c.id === martha!.id), 'client must still exist').toBe(true)
    const ridesAfter = await $fetch<Ride[]>('/api/get/rides', { headers: { cookie } })
    const marthaRidesAfter = ridesAfter.filter((r) => r.clientId === martha!.id)
    expect(marthaRidesAfter.length, 'client rides must be preserved').toBe(marthaRides.length)
  })

  it('still deletes a client that has no rides (200)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    const created = await $fetch<{ id: string }>('/api/post/clients', {
      method: 'POST',
      headers: { cookie },
      body: {
        name: 'No-Rides Client',
        email: `no-rides-${Date.now()}@example.com`,
        phone: '555-0000',
        street: '1 Empty St',
        city: 'Nowhere',
        state: 'TX',
        zip: '75000',
      },
    })
    expect(created.id).toBeTruthy()

    const res = await appFetch(`/api/delete/clients/${created.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(res.status, 'deleting a ride-less client should succeed').toBe(200)

    const clientsAfter = await $fetch<ClientRow[]>('/api/get/clients', { headers: { cookie } })
    expect(clientsAfter.some((c) => c.id === created.id)).toBe(false)
  })

  it('resets a deleted volunteer\'s ASSIGNED rides back to CREATED (not stuck)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    // Create a throwaway volunteer, assign them a ride, then delete them.
    const vol = await $fetch<{ id: string }>('/api/post/volunteers', {
      method: 'POST',
      headers: { cookie },
      body: {
        name: 'Throwaway Volunteer',
        email: `throwaway-vol-${Date.now()}@example.com`,
        phone: '555-1111',
      },
    })
    expect(vol.id).toBeTruthy()

    // Grab any existing client to attach a ride to.
    const clients = await $fetch<ClientRow[]>('/api/get/clients', { headers: { cookie } })
    const someClient = clients[0]
    expect(someClient).toBeTruthy()

    const ride = await $fetch<{ id: string; status: string }>('/api/post/rides', {
      method: 'POST',
      headers: { cookie },
      body: {
        clientId: someClient!.id,
        volunteerId: vol.id,
        pickup: { street: '1 Test St', city: 'Dallas', state: 'TX', zip: '75001' },
        dropoff: { street: '2 Test Ave', city: 'Dallas', state: 'TX', zip: '75002' },
        scheduledTime: new Date(Date.now() + 86400000).toISOString(),
      },
    })
    expect(ride.id).toBeTruthy()
    // volunteerId present -> the endpoint sets status ASSIGNED.
    expect(ride.status).toBe('ASSIGNED')

    const delRes = await appFetch(`/api/delete/volunteers/${vol.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(delRes.status, 'deleting a volunteer should succeed').toBe(200)

    const ridesAfter = await $fetch<Ride[]>('/api/get/rides', { headers: { cookie } })
    const affected = ridesAfter.find((r) => r.id === ride.id)
    expect(affected, 'the ride should still exist').toBeTruthy()
    expect(affected!.volunteerId, 'volunteer link should be cleared').toBeNull()
    expect(affected!.status, 'ride must not be stuck ASSIGNED').toBe('CREATED')
  })
})
