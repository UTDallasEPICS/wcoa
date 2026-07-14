import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #53 (#15 sibling): the admin create/update endpoints
// (server/api/post/admins/index.ts, server/api/put/admins/[id].ts) still passed
// phone: body.phone unsanitized. Clearing a second admin's phone (sending "")
// stores a duplicate "" and trips the User.phone @unique constraint -> P2002 ->
// 500. Blank phones must be stored as null so any number of admins can have "no
// phone". #15 fixed this for volunteers/clients but not admins.
//
// Uses throwaway unique emails and deletes them again so the shared seeded DB
// isn't disturbed (cleanup runs inside each test, not afterAll — Nuxt's test
// context is torn down before afterAll hooks fire).

type AdminUser = { id: string; email: string; phone: string | null }

async function getAdmin(cookie: string, email: string): Promise<AdminUser> {
  const { items: admins } = await $fetch<{ items: AdminUser[] }>('/api/get/admins?pageSize=100', {
    headers: { cookie },
  })
  const a = admins.find((a) => a.email === email)
  expect(a, `admin ${email} should exist`).toBeTruthy()
  return a!
}

async function deleteAdmin(cookie: string, id: string): Promise<void> {
  await $fetch(`/api/delete/admins/${id}`, {
    method: 'DELETE',
    headers: { cookie },
  }).catch(() => {})
}

describe('issue #53 — blank admin phone numbers must be stored as null', () => {
  it('clearing phone ("") on two different admins both succeed and store null', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')

    // Two throwaway admins with unique emails, each seeded with a phone.
    const stamp = Date.now()
    const emailA = `throwaway-admin-a-${stamp}@example.com`
    const emailB = `throwaway-admin-b-${stamp}@example.com`
    const ids: string[] = []

    try {
      const a = await $fetch<AdminUser>('/api/post/admins', {
        method: 'POST',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Throwaway Admin A', email: emailA, phone: '4695551111' },
      })
      ids.push(a.id)
      const b = await $fetch<AdminUser>('/api/post/admins', {
        method: 'POST',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Throwaway Admin B', email: emailB, phone: '4695552222' },
      })
      ids.push(b.id)

      // First clear via PUT: succeeds even pre-fix ("" is unique so far).
      await $fetch(`/api/put/admins/${a.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Throwaway Admin A', email: emailA, phone: '' },
      })

      // Second clear via PUT: pre-fix this stores another "" and trips @unique ->
      // P2002 -> 500. Post-fix it stores null and succeeds.
      await $fetch(`/api/put/admins/${b.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Throwaway Admin B', email: emailB, phone: '' },
      })

      const aAfter = await getAdmin(adminCookie, emailA)
      const bAfter = await getAdmin(adminCookie, emailB)
      expect(aAfter.phone).toBeNull()
      expect(bAfter.phone).toBeNull()
    } finally {
      for (const id of ids) await deleteAdmin(adminCookie, id)
    }
  })

  it('creating an admin with a blank phone stores null (POST create branch)', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')

    const email = `throwaway-admin-c-${Date.now()}@example.com`
    let id: string | undefined

    try {
      const created = await $fetch<AdminUser>('/api/post/admins', {
        method: 'POST',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Throwaway Admin C', email, phone: '' },
      })
      id = created.id

      const after = await getAdmin(adminCookie, email)
      expect(after.phone).toBeNull()
    } finally {
      if (id) await deleteAdmin(adminCookie, id)
    }
  })
})
