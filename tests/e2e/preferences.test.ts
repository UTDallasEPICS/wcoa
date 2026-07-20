import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// DB-backed, cross-device UI preferences (rides list filter/sort). The row is
// always the caller's own (no id in the path); the DB is reseeded per file so
// no preference rows exist at the start.
type Prefs = {
  rideStatusFilter: string[] | null
  rideSort: string | null
  rideAssignedToMeOnly: boolean
}

describe('user preferences API', () => {
  it('returns defaults (nulls/false) for a user who has never saved', async () => {
    const cookie = await loginAs('alice@example.com')
    const res = await $fetch<Prefs>('/api/get/preferences', { headers: { cookie } })
    expect(res.rideStatusFilter).toBeNull()
    expect(res.rideSort).toBeNull()
    expect(res.rideAssignedToMeOnly).toBe(false)
  })

  it('persists a PUT and reads it back (status filter round-trips as an array)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const put = await $fetch<Prefs>('/api/put/preferences', {
      method: 'PUT',
      headers: { cookie },
      body: { rideStatusFilter: ['CREATED', 'COMPLETED'], rideSort: 'asc' },
    })
    expect(put.rideStatusFilter).toEqual(['CREATED', 'COMPLETED'])
    expect(put.rideSort).toBe('asc')

    const get = await $fetch<Prefs>('/api/get/preferences', { headers: { cookie } })
    expect(get.rideStatusFilter).toEqual(['CREATED', 'COMPLETED'])
    expect(get.rideSort).toBe('asc')
  })

  it('is a partial upsert — an omitted field is left untouched', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    // Only change the sort; the status filter set above must survive.
    const put = await $fetch<Prefs>('/api/put/preferences', {
      method: 'PUT',
      headers: { cookie },
      body: { rideSort: 'desc' },
    })
    expect(put.rideSort).toBe('desc')
    expect(put.rideStatusFilter).toEqual(['CREATED', 'COMPLETED'])
  })

  it('lets a volunteer save their own preference (self-service write, not a 403)', async () => {
    const cookie = await loginAs('bob@example.com')
    const res = await $fetch<Prefs>('/api/put/preferences', {
      method: 'PUT',
      headers: { cookie },
      body: { rideAssignedToMeOnly: true },
    })
    expect(res.rideAssignedToMeOnly).toBe(true)
  })

  it('scopes preferences per user', async () => {
    // bob (above) set assignedToMe=true and never set a status filter; the
    // admin's saved status filter must not leak into bob's row.
    const cookie = await loginAs('bob@example.com')
    const bob = await $fetch<Prefs>('/api/get/preferences', { headers: { cookie } })
    expect(bob.rideAssignedToMeOnly).toBe(true)
    expect(bob.rideStatusFilter).toBeNull()
  })

  it('rejects an invalid status with 400', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    await expect(
      $fetch('/api/put/preferences', {
        method: 'PUT',
        headers: { cookie },
        body: { rideStatusFilter: ['BOGUS'] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects an unknown key with 400 (strict schema)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    await expect(
      $fetch('/api/put/preferences', {
        method: 'PUT',
        headers: { cookie },
        body: { evil: true },
      }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('requires authentication', async () => {
    await expect($fetch('/api/get/preferences')).rejects.toMatchObject({ statusCode: 401 })
    await expect(
      $fetch('/api/put/preferences', { method: 'PUT', body: { rideSort: 'asc' } }),
    ).rejects.toMatchObject({ statusCode: 401 })
  })
})
