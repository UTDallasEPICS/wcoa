import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Pins for the KNOWN BUGS found by the 2026-07-14 exhaustive audit
// (issues #87–#97). Each `it.fails` test asserts the *correct* behavior from
// REQUIREMENTS.md, so while the bug is open it fails (and `it.fails` turns that
// into a pass).
//
// WHEN YOU FIX ONE OF THESE ISSUES: its pin will start "failing" (because the
// assertions now pass). That is the signal to (1) change `it.fails` → `it`,
// and (2) keep the test forever as the regression guard for your fix.
//
// Already fixed + flipped to plain `it` (kept here as permanent regression
// guards): R-135 (#87), R-082/R-083 (#88), R-027 (#93).
//
// The plain `it` at the bottom (R-173) pins CURRENT behavior for the open
// completionRate decision (#96) — flip its assertions when the owner decides.

const ADMIN = 'reachtusharwani@gmail.com'
const BOB = 'bob@example.com'
const json = (cookie: string) => ({ 'content-type': 'application/json', cookie })
const RUN = `kb${Date.now().toString(36)}`

async function createClient(cookie: string, name: string, email: string, phone?: string) {
  return await $fetch<{ id: string; userId: string }>('/api/post/clients', {
    method: 'POST',
    headers: json(cookie),
    body: { name, email, phone, street: `${RUN} 1 Pin St`, city: 'Plano', state: 'TX', zip: '75074' },
  })
}

async function createRide(cookie: string, clientId: string) {
  return await $fetch<{ id: string }>('/api/post/rides', {
    method: 'POST',
    headers: json(cookie),
    body: {
      clientId,
      pickup: { street: `${RUN} 1 Pin St`, city: 'Plano', state: 'TX', zip: '75074' },
      dropoff: { street: `${RUN} 2 Pin Ave`, city: 'Plano', state: 'TX', zip: '75074' },
      scheduledTime: new Date(Date.now() + 2 * 86400000).toISOString(),
    },
  })
}

describe('known-bug pins (issues #87–#97) — R-IDs from REQUIREMENTS.md', () => {
  it('R-135 (#87): a volunteer can complete their OWN assigned ride', async () => {
    const admin = await loginAs(ADMIN)
    const bob = await loginAs(BOB)
    const client = await createClient(admin, `${RUN} B87`, `${RUN}-87@example.com`)
    const ride = await createRide(admin, client.id)
    await $fetch(`/api/post/rides/${ride.id}/signup`, { method: 'POST', headers: json(bob) })

    // #87 fixed via a dedicated self-service endpoint: the assigned volunteer
    // completes through POST /api/post/rides/[id]/complete (the UI's "Mark as
    // Completed" now calls this). PUT /api/put/rides stays admin-only.
    const res = await appFetch(`/api/post/rides/${ride.id}/complete`, {
      method: 'POST',
      headers: json(bob),
      body: JSON.stringify({ totalRideTime: 1.5 }),
    })
    expect(res.status).toBe(200)
  })

  it('R-082 (#88): delete/admins refuses to archive a non-ADMIN user', async () => {
    const admin = await loginAs(ADMIN)
    const bob = await loginAs(BOB)
    const bobUser = await $fetch<{ userId: string }>('/api/get/volunteers/bySession', {
      headers: { cookie: bob },
    })
    // Currently: 200, archives the volunteer's user row while the volunteer
    // profile stays active.
    const res = await appFetch(`/api/delete/admins/${bobUser.userId}`, {
      method: 'DELETE',
      headers: json(admin),
    })
    expect(res.status).toBe(404)
  })

  it('R-083 (#88): an admin cannot delete their own account', async () => {
    const admin = await loginAs(ADMIN)
    const email = `${RUN}-selfdel@example.com`
    const created = await $fetch<{ id: string }>('/api/post/admins', {
      method: 'POST', headers: json(admin), body: { name: `${RUN} SelfDel`, email },
    })
    const self = await loginAs(email)
    // Currently: 200 (self-archive succeeds).
    const res = await appFetch(`/api/delete/admins/${created.id}`, {
      method: 'DELETE',
      headers: json(self),
    })
    expect([400, 403, 409]).toContain(res.status)
    // leave no half-state behind if the fix lands: archive via the real admin
    if (!res.ok) await appFetch(`/api/delete/admins/${created.id}`, { method: 'DELETE', headers: json(admin) })
  })

  it('R-045 (#89): a partial client update does not wipe email/phone', async () => {
    const admin = await loginAs(ADMIN)
    const email = `${RUN}-89@example.com`
    const client = await createClient(admin, `${RUN} B89`, email, '5559990089')

    await $fetch(`/api/put/clients/${client.id}`, {
      method: 'PUT', headers: json(admin), body: { name: `${RUN} B89 Renamed` },
    })
    // Currently: email and phone are both nulled by the name-only update.
    const user = await $fetch<{ email: string | null; phone: string | null }>(
      `/api/get/users/byId/${client.userId}`, { headers: { cookie: admin } }
    )
    expect(user.email).toBe(email)
    expect(user.phone).toBe('5559990089')
  })

  it('R-063 (#90): admin volunteer update rejects a bogus status enum', async () => {
    const admin = await loginAs(ADMIN)
    const created = await $fetch<{ id: string }>('/api/post/volunteers', {
      method: 'POST', headers: json(admin),
      body: { name: `${RUN} B90`, email: `${RUN}-90@example.com` },
    })
    // Currently: 200, and the string "BOGUS" is stored (drops the volunteer out
    // of AVAILABLE broadcasts silently).
    const res = await appFetch(`/api/put/volunteers/${created.id}`, {
      method: 'PUT', headers: json(admin), body: JSON.stringify({ status: 'BOGUS' }),
    })
    expect(res.status).toBe(400)
  })

  it('R-104 (#90): ride create rejects malformed input with 400, never 500', async () => {
    const admin = await loginAs(ADMIN)
    // Currently: 500 (raw FK error surfaces).
    const badClient = await appFetch('/api/post/rides', {
      method: 'POST', headers: json(admin),
      body: JSON.stringify({
        clientId: 'nonexistent-id',
        pickup: { street: '1 A St', city: 'Plano', state: 'TX', zip: '75074' },
        dropoff: { street: '2 B St', city: 'Plano', state: 'TX', zip: '75074' },
        scheduledTime: new Date(Date.now() + 86400000).toISOString(),
      }),
    })
    expect(badClient.status).toBe(400)
  })

  it('R-081 (#91): admin update of an unknown id returns 404, not 500', async () => {
    const admin = await loginAs(ADMIN)
    const res = await appFetch('/api/put/admins/nonexistent-id', {
      method: 'PUT', headers: json(admin), body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })

  it('R-190 (#91): updating an UNKNOWN template name with a valid body returns 404, not 500', async () => {
    // Found BY this framework (2026-07-14): the audit's hand probe used an empty
    // body, which 400s on validation before reaching the unhandled P2025.
    const admin = await loginAs(ADMIN)
    const res = await appFetch('/api/put/notifications/templates/NO_SUCH_TEMPLATE', {
      method: 'PUT', headers: json(admin), body: JSON.stringify({ subject: 'x', body: 'y' }),
    })
    expect([400, 404]).toContain(res.status)
  })

  it('R-047 (#91): duplicate email on a client update returns a clean 4xx, not 500', async () => {
    const admin = await loginAs(ADMIN)
    const a = await createClient(admin, `${RUN} B91a`, `${RUN}-91a@example.com`)
    await createClient(admin, `${RUN} B91b`, `${RUN}-91b@example.com`)
    const res = await appFetch(`/api/put/clients/${a.id}`, {
      method: 'PUT', headers: json(admin),
      body: JSON.stringify({ name: `${RUN} B91a`, email: `${RUN}-91b@example.com` }),
    })
    expect([400, 409]).toContain(res.status)
  })

  it.fails('R-048 (#92): creating a client with an existing VOLUNTEER email is rejected', async () => {
    const admin = await loginAs(ADMIN)
    // Currently: 200 — bob becomes a dual volunteer+client profile (and loses
    // his phone via the #89 wipe on the upsert branch).
    const res = await appFetch('/api/post/clients', {
      method: 'POST', headers: json(admin),
      body: JSON.stringify({
        name: 'Bob Tester', email: BOB,
        street: `${RUN} 3 Pin St`, city: 'Plano', state: 'TX', zip: '75074',
      }),
    })
    expect([400, 409]).toContain(res.status)
  })

  it('R-027 (#93): estimate applies byId record-scoping for volunteers', async () => {
    const admin = await loginAs(ADMIN)
    const alice = await loginAs('alice@example.com')
    const bob = await loginAs(BOB)
    // Build a ride that belongs to alice; bob must not be able to see either view.
    const client = await createClient(admin, `${RUN} B93`, `${RUN}-93@example.com`)
    const ride = await createRide(admin, client.id)
    await $fetch(`/api/post/rides/${ride.id}/signup`, { method: 'POST', headers: json(alice) })

    const byId = await appFetch(`/api/get/rides/byId/${ride.id}`, { headers: { cookie: bob } })
    expect(byId.status).toBe(404) // already correct today — the control

    // Currently: 200 (no scoping on the estimate endpoint).
    const estimate = await appFetch(`/api/get/rides/estimate/${ride.id}`, { headers: { cookie: bob } })
    expect(estimate.status).toBe(404)
  })

  it.fails('R-114/R-158 (#94): missing-record GETs return 404, not 204 null', async () => {
    const admin = await loginAs(ADMIN)
    const ride = await appFetch('/api/get/rides/byId/nonexistent-id', { headers: { cookie: admin } })
    expect(ride.status).toBe(404)
    const byEmail = await appFetch('/api/get/users/byEmail/nobody@example.com', { headers: { cookie: admin } })
    expect(byEmail.status).toBe(404)
    const byId = await appFetch('/api/get/users/byId/nonexistent-id', { headers: { cookie: admin } })
    expect(byId.status).toBe(404)
  })

  it.fails('R-108 (#95): a COMPLETED ride cannot be reset to CREATED', async () => {
    const admin = await loginAs(ADMIN)
    const client = await createClient(admin, `${RUN} B95`, `${RUN}-95@example.com`)
    const ride = await createRide(admin, client.id)
    await $fetch(`/api/put/rides/${ride.id}`, {
      method: 'PUT', headers: json(admin), body: { status: 'COMPLETED', totalRideTime: 1 },
    })
    // Currently: 200 — the ride re-enters the pool keeping its stale totalRideTime.
    const res = await appFetch(`/api/put/rides/${ride.id}`, {
      method: 'PUT', headers: json(admin), body: JSON.stringify({ status: 'CREATED' }),
    })
    expect(res.status).toBe(400)
  })

  it.fails('R-155 (#97): get/users returns a bounded pagination envelope', async () => {
    const admin = await loginAs(ADMIN)
    // Currently: a bare unbounded array.
    const res = await $fetch<{ items: unknown[]; total: number }>('/api/get/users', {
      headers: { cookie: admin },
    })
    expect(Array.isArray(res.items)).toBe(true)
    expect(typeof res.total).toBe('number')
  })

  // ---- Decision pin (not a bug pin): flips when the owner decides #96.
  it('R-173 (#96): CURRENT behavior — CANCELLED rides count in the completionRate denominator', async () => {
    const admin = await loginAs(ADMIN)
    const before = await $fetch<{ total: number; completed: number }>(
      '/api/get/metrics/completionRate', { headers: { cookie: admin } }
    )
    const client = await createClient(admin, `${RUN} B96`, `${RUN}-96@example.com`)
    const ride = await createRide(admin, client.id)
    await $fetch(`/api/put/rides/${ride.id}`, {
      method: 'PUT', headers: json(admin), body: { status: 'CANCELLED' },
    })
    const after = await $fetch<{ total: number; completed: number }>(
      '/api/get/metrics/completionRate', { headers: { cookie: admin } }
    )
    // If you are here because this started failing: the denominator decision
    // (#96) was implemented. Update this assertion to `before.total` and move
    // the test into requirements-flows.test.ts.
    expect(after.total).toBe(before.total + 1)
    expect(after.completed).toBe(before.completed)
  })
})
