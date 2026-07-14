import { afterAll, describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #8: deleting a Client/Volunteer profile used to leave the parent User
// row behind — an orphaned User with role CLIENT/VOLUNTEER but no profile,
// which crashes frontend queries that read `user.volunteer.id` / `user.client.id`.
// The fix deletes the underlying User (which cascades the profile away), and
// must preserve #23's ride safety (409 block for clients with rides, and the
// transactional ASSIGNED->CREATED reset for volunteers).

const uniq = () => Math.random().toString(36).slice(2, 10)

async function getUsers(cookie: string) {
  return await $fetch<Array<{ id: string; email: string | null }>>(
    '/api/get/users',
    { headers: { cookie } }
  )
}

describe('issue #8 — deletion removes the parent User (no orphans)', () => {
  const createdEmails: string[] = []

  afterAll(async () => {
    // Best-effort cleanup so we don't disturb the shared seeded DB.
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const users = await getUsers(cookie).catch(() => [])
    for (const u of users) {
      if (u.email && createdEmails.includes(u.email)) {
        await $fetch(`/api/delete/admins/${u.id}`, {
          method: 'DELETE',
          headers: { cookie },
        }).catch(() => {})
      }
    }
  })

  it('deleting a fresh volunteer removes its User (no orphan)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const email = `orphan-vol-${uniq()}@example.com`
    createdEmails.push(email)

    const volunteer = await $fetch<{ id: string; userId: string }>(
      '/api/post/volunteers',
      {
        method: 'POST',
        headers: { cookie },
        body: { name: 'Orphan Vol', email, status: 'AVAILABLE' },
      }
    )

    await $fetch(`/api/delete/volunteers/${volunteer.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    const users = await getUsers(cookie)
    const stillThere = users.find((u) => u.id === volunteer.userId)
    expect(stillThere, 'parent User should be deleted, not orphaned').toBeUndefined()
    expect(users.some((u) => u.email === email)).toBe(false)
  })

  it('deleting a fresh ride-less client removes its User (no orphan)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const email = `orphan-cli-${uniq()}@example.com`
    createdEmails.push(email)

    const client = await $fetch<{ id: string; userId: string }>(
      '/api/post/clients',
      {
        method: 'POST',
        headers: { cookie },
        body: {
          name: 'Orphan Cli',
          email,
          street: '1 Test St',
          city: 'Dallas',
          state: 'TX',
          zip: '75001',
        },
      }
    )

    await $fetch(`/api/delete/clients/${client.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    const users = await getUsers(cookie)
    const stillThere = users.find((u) => u.id === client.userId)
    expect(stillThere, 'parent User should be deleted, not orphaned').toBeUndefined()
    expect(users.some((u) => u.email === email)).toBe(false)
  })

  it('deleting a client WITH rides still 409s and leaves client + user intact (#23)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    const { items: clients } = await $fetch<{
      items: Array<{ id: string; userId: string; user: { email: string | null } }>
    }>('/api/get/clients?pageSize=100', { headers: { cookie } })
    const martha = clients.find((c) => c.user.email === 'martha@example.com')
    expect(martha, 'seeded client martha should exist').toBeDefined()

    await expect(
      $fetch(`/api/delete/clients/${martha!.id}`, {
        method: 'DELETE',
        headers: { cookie },
      })
    ).rejects.toMatchObject({ statusCode: 409 })

    // Both the client profile and its user remain.
    const { items: clientsAfter } = await $fetch<{ items: Array<{ id: string }> }>(
      '/api/get/clients?pageSize=100',
      { headers: { cookie } }
    )
    expect(clientsAfter.some((c) => c.id === martha!.id)).toBe(true)
    const users = await getUsers(cookie)
    expect(users.some((u) => u.id === martha!.userId)).toBe(true)
  })

  it('deleting a volunteer resets its ASSIGNED rides to CREATED AND removes the User (#23)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const email = `orphan-vol-rides-${uniq()}@example.com`
    createdEmails.push(email)

    const volunteer = await $fetch<{ id: string; userId: string }>(
      '/api/post/volunteers',
      {
        method: 'POST',
        headers: { cookie },
        body: { name: 'Vol With Rides', email, status: 'AVAILABLE' },
      }
    )

    // Grab a seeded CREATED ride and assign it to this volunteer.
    const { items: rides } = await $fetch<{ items: Array<{ id: string; status: string }> }>(
      '/api/get/rides?pageSize=100',
      { headers: { cookie } }
    )
    const openRide = rides.find((r) => r.status === 'CREATED')
    expect(openRide, 'a CREATED ride should exist to assign').toBeDefined()

    await $fetch(`/api/put/rides/${openRide!.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { volunteerId: volunteer.id, status: 'ASSIGNED' },
    })

    await $fetch(`/api/delete/volunteers/${volunteer.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    // Ride reset back to CREATED (available pool), User gone.
    const { items: ridesAfter } = await $fetch<{ items: Array<{ id: string; status: string }> }>(
      '/api/get/rides?pageSize=100',
      { headers: { cookie } }
    )
    const ride = ridesAfter.find((r) => r.id === openRide!.id)
    expect(ride?.status).toBe('CREATED')

    const users = await getUsers(cookie)
    expect(users.some((u) => u.id === volunteer.userId)).toBe(false)
  })
})
