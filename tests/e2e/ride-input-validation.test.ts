import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Regression coverage for issue #31: PUT /api/put/rides/[id] spread the raw
// request body straight into prisma.ride.update, allowing mass assignment of
// any column and 500-ing on unknown keys.

async function adminCookie() {
  return loginAs('reachtusharwani@gmail.com')
}

async function firstRideId(cookie: string): Promise<string> {
  const rides = await $fetch<Array<{ id: string }>>('/api/get/rides', {
    headers: { cookie },
  })
  expect(rides.length).toBeGreaterThan(0)
  return rides[0]!.id
}

describe('PUT /api/put/rides/[id] input validation (#31)', () => {
  it('rejects a forbidden field (mass assignment) with 400 and does not persist it', async () => {
    const cookie = await adminCookie()
    const id = await firstRideId(cookie)

    const before = await $fetch<{ clientId: string }>(`/api/get/rides/byId/${id}`, {
      headers: { cookie },
    })

    await expect(
      $fetch(`/api/put/rides/${id}`, {
        method: 'PUT',
        headers: { cookie },
        body: {
          status: 'ASSIGNED',
          clientId: 'forged-client-id',
          totalRideTime: 999,
          createdAt: '2000-01-01T00:00:00.000Z',
        },
      })
    ).rejects.toMatchObject({ statusCode: 400 })

    const after = await $fetch<{ clientId: string }>(`/api/get/rides/byId/${id}`, {
      headers: { cookie },
    })
    // The forbidden clientId must not have been written.
    expect(after.clientId).toBe(before.clientId)
    expect(after.clientId).not.toBe('forged-client-id')
  })

  it('rejects an unknown/bogus key with 400 instead of an opaque 500', async () => {
    const cookie = await adminCookie()
    const id = await firstRideId(cookie)

    await expect(
      $fetch(`/api/put/rides/${id}`, {
        method: 'PUT',
        headers: { cookie },
        body: { notAColumn: 'boom' },
      })
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('accepts a valid update (status + notes) and returns 200', async () => {
    const cookie = await adminCookie()
    const id = await firstRideId(cookie)

    const updated = await $fetch<{ status: string; notes: string | null }>(
      `/api/put/rides/${id}`,
      {
        method: 'PUT',
        headers: { cookie },
        body: { status: 'ASSIGNED', notes: 'validated update ok' },
      }
    )
    expect(updated.status).toBe('ASSIGNED')
    expect(updated.notes).toBe('validated update ok')
  })

  it('accepts unassigning a volunteer via empty-string volunteerId (preserved behavior)', async () => {
    const cookie = await adminCookie()
    const id = await firstRideId(cookie)

    const updated = await $fetch<{ volunteerId: string | null }>(`/api/put/rides/${id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { volunteerId: '' },
    })
    expect(updated.volunteerId).toBeNull()
  })
})
