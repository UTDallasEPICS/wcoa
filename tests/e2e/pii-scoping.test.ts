import { describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { loginAs } from '../utils/auth'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
})

// Issue #3: a VOLUNTEER used to receive the entire ride/people database (full
// PII) and the app filtered it client-side. The server must instead scope the
// data to what the requesting user is authorized to see.

type Ride = {
  id: string
  status: string
  volunteer: { userId: string } | null
  client: { user: { name: string; phone: string | null } } | null
}

describe('issue #3 — server-side PII scoping', () => {
  it('ADMIN still receives every ride (full dataset)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const rides = await $fetch<Ride[]>('/api/get/rides', { headers: { cookie } })
    expect(Array.isArray(rides)).toBe(true)
    // Seed has 9 rides across all volunteers/clients.
    expect(rides.length).toBeGreaterThanOrEqual(9)
    // Admin can see rides assigned to volunteers other than themselves.
    expect(rides.some((r) => r.volunteer !== null)).toBe(true)
  })

  it('VOLUNTEER only receives available (CREATED) rides plus their own', async () => {
    const bobCookie = await loginAs('bob@example.com')
    const me = await $fetch<{ user: { id: string } }>('/api/get/volunteers/bySession', {
      headers: { cookie: bobCookie },
    })
    const myUserId = me.user.id

    const rides = await $fetch<Ride[]>('/api/get/rides', { headers: { cookie: bobCookie } })

    // Every returned ride must be either available (CREATED) or assigned to Bob.
    for (const ride of rides) {
      const isAvailable = ride.status === 'CREATED'
      const isMine = ride.volunteer?.userId === myUserId
      expect(
        isAvailable || isMine,
        `ride ${ride.id} (status=${ride.status}) leaked to a volunteer it does not belong to`
      ).toBe(true)
    }

    // No ride assigned to a *different* volunteer may appear (this is the leak).
    const foreignAssigned = rides.filter(
      (r) => r.volunteer && r.volunteer.userId !== myUserId
    )
    expect(foreignAssigned).toEqual([])

    // Bob must still see his own assigned ride and available rides.
    expect(rides.some((r) => r.volunteer?.userId === myUserId)).toBe(true)
    expect(rides.some((r) => r.status === 'CREATED')).toBe(true)
  })

  it('VOLUNTEER cannot bulk-download the client roster (PII)', async () => {
    const bobCookie = await loginAs('bob@example.com')
    await expect(
      $fetch('/api/get/clients', { headers: { cookie: bobCookie } })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('VOLUNTEER cannot bulk-download the volunteer roster (PII)', async () => {
    const bobCookie = await loginAs('bob@example.com')
    await expect(
      $fetch('/api/get/volunteers', { headers: { cookie: bobCookie } })
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('ADMIN can still read the client and volunteer rosters', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const clients = await $fetch<unknown[]>('/api/get/clients', { headers: { cookie } })
    const volunteers = await $fetch<unknown[]>('/api/get/volunteers', { headers: { cookie } })
    expect(Array.isArray(clients)).toBe(true)
    expect(clients.length).toBeGreaterThanOrEqual(3)
    expect(Array.isArray(volunteers)).toBe(true)
    expect(volunteers.length).toBeGreaterThanOrEqual(3)
  })
})
