import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #15: clearing a phone number sends "" from the frontend. SQLite treats
// "" as a distinct value, so the User.phone @unique constraint lets the first
// blank through but rejects the SECOND with P2002 (a 500). Blank phones must be
// stored as null so any number of users can have "no phone".

type VolunteerWithUser = {
  id: string
  user: { id: string; email: string; phone: string | null }
}

async function getVolunteer(cookie: string, email: string): Promise<VolunteerWithUser> {
  const { items: volunteers } = await $fetch<{ items: VolunteerWithUser[] }>(
    '/api/get/volunteers?pageSize=100',
    { headers: { cookie } }
  )
  const v = volunteers.find((v) => v.user.email === email)
  expect(v, `seeded volunteer ${email} should exist`).toBeTruthy()
  return v!
}

describe('issue #15 — blank phone numbers must be stored as null', () => {
  it('clearing phone (phone: "") on two different volunteers both succeed and store null', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')

    const bob = await getVolunteer(adminCookie, 'bob@example.com')
    const alice = await getVolunteer(adminCookie, 'alice@example.com')

    try {
      // First clear: succeeds even pre-fix ("" is unique so far).
      await $fetch(`/api/put/volunteers/${bob.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: bob.user.email, email: bob.user.email, phone: '' },
      })

      // Second clear: pre-fix this stores another "" and trips the @unique
      // constraint -> P2002 -> 500. Post-fix it stores null and succeeds.
      await $fetch(`/api/put/volunteers/${alice.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: alice.user.email, email: alice.user.email, phone: '' },
      })

      // Both phones must now be null (not "").
      const bobAfter = await getVolunteer(adminCookie, 'bob@example.com')
      const aliceAfter = await getVolunteer(adminCookie, 'alice@example.com')
      expect(bobAfter.user.phone).toBeNull()
      expect(aliceAfter.user.phone).toBeNull()
    } finally {
      // Restore seeded phones (shared DB) so other suites aren't disturbed.
      await $fetch(`/api/put/volunteers/${bob.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Bob Tester', email: 'bob@example.com', phone: '4695550202' },
      }).catch(() => {})
      await $fetch(`/api/put/volunteers/${alice.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Alice Springs', email: 'alice@example.com', phone: '2145550404' },
      }).catch(() => {})
    }
  })

  it('whitespace-only phone is also stored as null', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')
    const bob = await getVolunteer(adminCookie, 'bob@example.com')

    try {
      await $fetch(`/api/put/volunteers/${bob.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Bob Tester', email: 'bob@example.com', phone: '   ' },
      })
      const after = await getVolunteer(adminCookie, 'bob@example.com')
      expect(after.user.phone).toBeNull()
    } finally {
      await $fetch(`/api/put/volunteers/${bob.id}`, {
        method: 'PUT',
        headers: { cookie: adminCookie, 'content-type': 'application/json' },
        body: { name: 'Bob Tester', email: 'bob@example.com', phone: '4695550202' },
      }).catch(() => {})
    }
  })
})
