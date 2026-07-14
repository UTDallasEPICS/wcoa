import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #41: #3 scoped the *list* endpoints, but single-record and other
// authenticated endpoints still returned full data to any logged-in non-admin.
//   - get/rides/byId/[id]  — a volunteer could fetch ANY ride (client PII),
//     even one not theirs and not available -> must be record-scoped.
//   - get/users/*, get/admins, get/addresses, get/metrics/* — admin-only data.

type Ride = {
  id: string
  status: string
  volunteer: { userId: string } | null
  client: { user: { name: string; phone: string | null } } | null
}

describe('issue #41 — single-record & admin-only endpoint scoping', () => {
  describe('get/rides/byId/[id] — record scoping', () => {
    it('VOLUNTEER cannot fetch another volunteer\'s non-available ride by id (404)', async () => {
      const adminCookie = await loginAs('reachtusharwani@gmail.com')
      const bobCookie = await loginAs('bob@example.com')
      const me = await $fetch<{ user: { id: string } }>('/api/get/volunteers/bySession', {
        headers: { cookie: bobCookie },
      })
      const myUserId = me.user.id

      // Admin sees every ride; find one that is NOT available (CREATED) and NOT
      // Bob's — i.e. a ride assigned to (or completed by) another volunteer.
      const { items: allRides } = await $fetch<{ items: Ride[] }>(
        '/api/get/rides?pageSize=100',
        { headers: { cookie: adminCookie } }
      )
      const foreign = allRides.find(
        (r) => r.status !== 'CREATED' && r.volunteer && r.volunteer.userId !== myUserId
      )
      expect(foreign, 'seed should contain a ride owned by another volunteer').toBeTruthy()

      await expect(
        $fetch(`/api/get/rides/byId/${foreign!.id}`, { headers: { cookie: bobCookie } })
      ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('VOLUNTEER CAN fetch an available (CREATED) ride by id', async () => {
      const adminCookie = await loginAs('reachtusharwani@gmail.com')
      const bobCookie = await loginAs('bob@example.com')

      const { items: allRides } = await $fetch<{ items: Ride[] }>(
        '/api/get/rides?pageSize=100',
        { headers: { cookie: adminCookie } }
      )
      const available = allRides.find((r) => r.status === 'CREATED')
      expect(available, 'seed should contain an available ride').toBeTruthy()

      const ride = await $fetch<Ride>(`/api/get/rides/byId/${available!.id}`, {
        headers: { cookie: bobCookie },
      })
      expect(ride.id).toBe(available!.id)
    })

    it('VOLUNTEER CAN fetch their own assigned ride by id', async () => {
      const adminCookie = await loginAs('reachtusharwani@gmail.com')
      const bobCookie = await loginAs('bob@example.com')
      const me = await $fetch<{ user: { id: string } }>('/api/get/volunteers/bySession', {
        headers: { cookie: bobCookie },
      })
      const myUserId = me.user.id

      const { items: allRides } = await $fetch<{ items: Ride[] }>(
        '/api/get/rides?pageSize=100',
        { headers: { cookie: adminCookie } }
      )
      const mine = allRides.find((r) => r.volunteer && r.volunteer.userId === myUserId)
      expect(mine, 'seed should contain a ride assigned to Bob').toBeTruthy()

      const ride = await $fetch<Ride>(`/api/get/rides/byId/${mine!.id}`, {
        headers: { cookie: bobCookie },
      })
      expect(ride.id).toBe(mine!.id)
    })

    it('ADMIN can fetch any ride by id', async () => {
      const adminCookie = await loginAs('reachtusharwani@gmail.com')
      const { items: allRides } = await $fetch<{ items: Ride[] }>(
        '/api/get/rides?pageSize=100',
        { headers: { cookie: adminCookie } }
      )
      const anyAssigned = allRides.find((r) => r.status !== 'CREATED' && r.volunteer)
      expect(anyAssigned).toBeTruthy()
      const ride = await $fetch<Ride>(`/api/get/rides/byId/${anyAssigned!.id}`, {
        headers: { cookie: adminCookie },
      })
      expect(ride.id).toBe(anyAssigned!.id)
    })
  })

  describe('admin-only endpoints', () => {
    const adminOnly = [
      '/api/get/users',
      '/api/get/admins',
      '/api/get/addresses',
      '/api/get/metrics/completionRate',
      '/api/get/metrics/hours',
      '/api/get/metrics/topRiders',
    ]

    for (const path of adminOnly) {
      it(`VOLUNTEER gets 403 on ${path}`, async () => {
        const bobCookie = await loginAs('bob@example.com')
        await expect(
          $fetch(path, { headers: { cookie: bobCookie } })
        ).rejects.toMatchObject({ statusCode: 403 })
      })

      it(`ADMIN still succeeds on ${path}`, async () => {
        const adminCookie = await loginAs('reachtusharwani@gmail.com')
        const res = await $fetch(path, { headers: { cookie: adminCookie } })
        expect(res).toBeDefined()
      })
    }

    it('VOLUNTEER gets 403 on get/users/byId/[id]', async () => {
      const adminCookie = await loginAs('reachtusharwani@gmail.com')
      const bobCookie = await loginAs('bob@example.com')
      const { items: admins } = await $fetch<{ items: { id: string }[] }>('/api/get/admins', {
        headers: { cookie: adminCookie },
      })
      const someUserId = admins[0]!.id
      await expect(
        $fetch(`/api/get/users/byId/${someUserId}`, { headers: { cookie: bobCookie } })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('ADMIN can read get/users/byId/[id]', async () => {
      const adminCookie = await loginAs('reachtusharwani@gmail.com')
      const { items: admins } = await $fetch<{ items: { id: string; email: string }[] }>(
        '/api/get/admins',
        { headers: { cookie: adminCookie } }
      )
      const target = admins[0]!
      const byId = await $fetch<{ id: string }>(`/api/get/users/byId/${target.id}`, {
        headers: { cookie: adminCookie },
      })
      expect(byId.id).toBe(target.id)
    })

    it('VOLUNTEER gets 403 on get/users/byEmail/[email] (admin still not 403)', async () => {
      const adminCookie = await loginAs('reachtusharwani@gmail.com')
      const bobCookie = await loginAs('bob@example.com')
      const email = 'martha@example.com'
      await expect(
        $fetch(`/api/get/users/byEmail/${email}`, { headers: { cookie: bobCookie } })
      ).rejects.toMatchObject({ statusCode: 403 })
      // ADMIN must not be blocked by the guard (200 with body or null, never 403).
      await $fetch(`/api/get/users/byEmail/${email}`, { headers: { cookie: adminCookie } })
    })
  })
})
