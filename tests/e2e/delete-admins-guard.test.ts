import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #88: DELETE /api/delete/admins/[id] was unguarded.
//   1. No role check — it looked up the target `user` by id with no
//      role: 'ADMIN' filter, so pointing it at a VOLUNTEER's user id returned
//      200 and archived that user while the `volunteer` row stayed active (a
//      half-archived state; ASSIGNED rides were NOT released, unlike a proper
//      delete/volunteers).
//   2. Self-delete was allowed — an admin could archive their own account.
//   3. No last-admin guard — nothing stopped archiving the final ADMIN, which
//      can permanently lock the org out of user management (only admins can
//      create admins via the admin-only POST /api/post/admins).
//
// Seeded (prisma/seed.ts): TWO admins — reachtusharwani@gmail.com (ADMIN_A) and
// tmw220003@utdallas.edu — plus volunteers bob@ / alice@.
//
// The DB is restored to the seed snapshot once per file (tests/setup-reset-db.ts),
// but tests within this file share state and run in order. These tests archive
// users (destructive), so they operate on disposable admins and only ever touch
// the seeded ADMIN_A / seeded volunteers non-destructively (or in the LAST test,
// which is allowed to leave ADMIN_A archived in a pre-fix run).

const ADMIN_A = 'reachtusharwani@gmail.com'
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

type UserRow = { id: string; email: string | null; role: string; deletedAt: string | null }
type AdminRow = { id: string; email: string | null }
type VolunteerRow = { id: string; userId: string; deletedAt: string | null; user: { email: string | null } }

async function getUsers(cookie: string): Promise<UserRow[]> {
  return await $fetch<UserRow[]>('/api/get/users', { headers: { cookie } })
}

async function getAdmins(cookie: string): Promise<AdminRow[]> {
  const { items } = await $fetch<{ items: AdminRow[] }>('/api/get/admins?pageSize=100', {
    headers: { cookie },
  })
  return items
}

async function getVolunteers(cookie: string): Promise<VolunteerRow[]> {
  const { items } = await $fetch<{ items: VolunteerRow[] }>('/api/get/volunteers?pageSize=100', {
    headers: { cookie },
  })
  return items
}

describe('DELETE /api/delete/admins/[id] guards (#88)', () => {
  // HEADLINE (must FAIL pre-fix / pass post-fix): the endpoint must refuse to
  // archive a non-admin. Pre-fix this returns 200 and archives the volunteer's
  // user row; post-fix the role: 'ADMIN' filter makes it a 404 and leaves the
  // volunteer fully intact.
  it('refuses to archive a non-admin (volunteer) user → 404, volunteer untouched', async () => {
    const cookie = await loginAs(ADMIN_A)

    const volunteers = await getVolunteers(cookie)
    const bob = volunteers.find((v) => v.user.email === 'bob@example.com')
    expect(bob, 'seeded volunteer bob should exist').toBeTruthy()
    const bobUserId = bob!.userId
    expect(bobUserId, 'volunteer should expose its underlying userId').toBeTruthy()

    const res = await appFetch(`/api/delete/admins/${bobUserId}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    // Pre-fix: 200 (the user is archived through the admin endpoint). This is the
    // headline failing assertion — quoted in the PR.
    expect(res.status, 'deleting a non-admin via the admin endpoint must 404').toBe(404)

    // The volunteer's user must still be active (no half-archive): still listed
    // among active users, and still in the volunteer roster (deletedAt null).
    const users = await getUsers(cookie)
    const bobUser = users.find((u) => u.id === bobUserId)
    expect(bobUser, 'volunteer user must still be active (not archived)').toBeTruthy()
    expect(bobUser!.role).toBe('VOLUNTEER')

    const volunteersAfter = await getVolunteers(cookie)
    const bobAfter = volunteersAfter.find((v) => v.userId === bobUserId)
    expect(bobAfter, 'volunteer profile must still be in the active roster').toBeTruthy()
    expect(bobAfter!.deletedAt, 'volunteer must not be archived').toBeNull()
  })

  // Self-delete guard, ISOLATED from the last-admin guard: with a disposable 2nd
  // admin plus the two seeded admins, deleting your own account is rejected 409
  // even though you are clearly not the last admin.
  it('rejects an admin deleting their own account → 409, account stays active', async () => {
    const adminCookie = await loginAs(ADMIN_A)

    const email = `disposable-selfdelete-${uniq()}@example.com`
    const created = await $fetch<{ id: string }>('/api/post/admins', {
      method: 'POST',
      headers: { cookie: adminCookie, 'content-type': 'application/json' },
      body: { name: 'Disposable Self-Delete Admin', email },
    })
    expect(created.id).toBeTruthy()

    // Log in AS the disposable admin and have them delete themselves.
    const selfCookie = await loginAs(email)
    const res = await appFetch(`/api/delete/admins/${created.id}`, {
      method: 'DELETE',
      headers: { cookie: selfCookie },
    })

    // Pre-fix: 200 (self-delete succeeds). Post-fix: 409.
    expect(res.status, 'self-delete must be rejected').toBe(409)

    // Still active — visible in the admin roster (checked as the seeded admin).
    const admins = await getAdmins(adminCookie)
    expect(admins.some((a) => a.id === created.id), 'self-deleted admin must still exist').toBe(true)
  })

  // Non-regression: a legit delete of a different, non-last admin must still work
  // (200 + archived). Proves the new guards don't over-block. Passes pre- AND
  // post-fix (correct behavior preserved).
  it('still archives a different, non-last admin → 200 and it is gone', async () => {
    const cookie = await loginAs(ADMIN_A)

    const email = `disposable-legit-${uniq()}@example.com`
    const created = await $fetch<{ id: string }>('/api/post/admins', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: { name: 'Disposable Legit Admin', email },
    })
    expect(created.id).toBeTruthy()

    const res = await appFetch(`/api/delete/admins/${created.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(res.status, 'deleting a non-self, non-last admin must succeed').toBe(200)

    const admins = await getAdmins(cookie)
    expect(admins.some((a) => a.id === created.id), 'deleted admin must be gone from roster').toBe(
      false
    )
  })

  // Last-admin lockout guard. NOTE: this cannot be isolated from the self-delete
  // guard at the API level — only an admin can call this endpoint, so deleting
  // "the last admin" is necessarily the caller deleting themselves, and the
  // self-delete guard (checked first) is what emits the 409 here. The count-based
  // guard in the handler is belt-and-suspenders. This test proves the end-to-end
  // guarantee: even reduced to a single admin, the org cannot be locked out.
  //
  // Destructive to ADMIN_A pre-fix (self-delete succeeds and archives it), so it
  // runs LAST — no later test depends on ADMIN_A's session.
  it('cannot delete the last remaining admin (lockout prevented) → 409', async () => {
    const cookie = await loginAs(ADMIN_A)

    // Resolve ADMIN_A's own user id, then archive every OTHER admin so ADMIN_A is
    // the sole remaining admin.
    let admins = await getAdmins(cookie)
    const self = admins.find((a) => a.email === ADMIN_A)
    expect(self, 'seeded ADMIN_A should be present').toBeTruthy()
    const selfId = self!.id

    for (const other of admins.filter((a) => a.id !== selfId)) {
      const delRes = await appFetch(`/api/delete/admins/${other.id}`, {
        method: 'DELETE',
        headers: { cookie },
      })
      expect(delRes.status, `archiving other admin ${other.id} should succeed`).toBe(200)
    }

    admins = await getAdmins(cookie)
    expect(admins.length, 'ADMIN_A must be the only remaining admin').toBe(1)
    expect(admins[0]!.id).toBe(selfId)

    // Now the sole admin tries to delete themselves — rejected (409). Pre-fix this
    // returns 200 and archives the last admin, locking the org out.
    const res = await appFetch(`/api/delete/admins/${selfId}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(res.status, 'deleting the last remaining admin must be rejected').toBe(409)

    const adminsAfter = await getAdmins(cookie)
    expect(adminsAfter.some((a) => a.id === selfId), 'last admin must still be active').toBe(true)
  })
})
