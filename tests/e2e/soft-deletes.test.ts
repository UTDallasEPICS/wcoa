import { describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #27 — Soft deletes for auditability.
//
// DELETE endpoints now archive records (set deletedAt) instead of destroying
// them, so active views hide them while historical metrics stay intact. This
// suite pins the four behaviours the owner signed off on:
//   1. A soft-deleted client disappears from GET /api/get/clients but its row
//      still exists in the DB with deletedAt set (verified via a direct read).
//   2. Unique reuse (decision #2): after soft-deleting a client, a NEW client
//      with the SAME email is created without a 409/500 (the released email
//      frees the unique slot).
//   3. Blocked login (decision #1): a soft-deleted user cannot complete the OTP
//      login flow — the OTP send is rejected, so loginAs throws.
//   4. Metrics preserved: a soft-deleted COMPLETED ride still counts in
//      completionRate / hours.
//   5. Session revocation (decision #1): soft-deleting a user deletes their
//      session rows, so a previously-valid cookie is rejected afterward.

const ADMIN = 'reachtusharwani@gmail.com'
const uniq = () => Math.random().toString(36).slice(2, 10)

function db() {
  const path = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
  return new Database(path, { readonly: true })
}

type ClientRow = { id: string; userId: string; user: { email: string | null } }

async function createClient(cookie: string, email: string) {
  return await $fetch<{ id: string; userId: string }>('/api/post/clients', {
    method: 'POST',
    headers: { cookie },
    body: {
      name: 'Soft Delete Client',
      email,
      phone: `555-${Math.floor(1000 + Math.random() * 8999)}`,
      street: `${Math.floor(Math.random() * 999)} Archive St`,
      city: 'Dallas',
      state: 'TX',
      zip: '75001',
    },
  })
}

describe('soft deletes (#27)', () => {
  it('archives a ride-less client (disappears from roster, row preserved with deletedAt)', async () => {
    const cookie = await loginAs(ADMIN)
    const email = `soft-client-${uniq()}@example.com`

    const client = await createClient(cookie, email)
    expect(client.id).toBeTruthy()

    const res = await appFetch(`/api/delete/clients/${client.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(res.status, 'soft delete should succeed').toBe(200)

    // Gone from the active roster.
    const clientsAfter = await $fetch<ClientRow[]>('/api/get/clients', {
      headers: { cookie },
    })
    expect(clientsAfter.some((c) => c.id === client.id)).toBe(false)

    // But the underlying rows still exist with deletedAt set (direct DB read),
    // and the user's email has been released to deletedEmail.
    const conn = db()
    try {
      const clientRow = conn
        .prepare('SELECT id, deletedAt FROM client WHERE id = ?')
        .get(client.id) as { id: string; deletedAt: string | null } | undefined
      expect(clientRow, 'client row must still exist (soft delete)').toBeTruthy()
      expect(clientRow!.deletedAt, 'client.deletedAt must be set').toBeTruthy()

      const userRow = conn
        .prepare(
          'SELECT deletedAt, email, deletedEmail FROM user WHERE id = ?'
        )
        .get(client.userId) as
        | { deletedAt: string | null; email: string | null; deletedEmail: string | null }
        | undefined
      expect(userRow, 'user row must still exist (soft delete)').toBeTruthy()
      expect(userRow!.deletedAt, 'user.deletedAt must be set').toBeTruthy()
      expect(userRow!.email, 'user.email must be released to null').toBeNull()
      expect(userRow!.deletedEmail, 'released email preserved in deletedEmail').toBe(email)
    } finally {
      conn.close()
    }
  })

  it('unique reuse: a new client can be created with a soft-deleted client\'s email (decision #2)', async () => {
    const cookie = await loginAs(ADMIN)
    const email = `reuse-${uniq()}@example.com`

    const first = await createClient(cookie, email)
    await appFetch(`/api/delete/clients/${first.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })

    // Re-adding a client with the SAME email must NOT hit a unique violation.
    const second = await createClient(cookie, email)
    expect(second.id, 'reused-email client should be created').toBeTruthy()
    expect(second.id).not.toBe(first.id)

    // The re-added client is live in the roster.
    const clients = await $fetch<ClientRow[]>('/api/get/clients', {
      headers: { cookie },
    })
    const live = clients.find((c) => c.user.email === email)
    expect(live, 'reused-email client should appear in the active roster').toBeTruthy()
    expect(live!.id).toBe(second.id)
  })

  it('blocked login: a soft-deleted user cannot complete the OTP login flow (decision #1)', async () => {
    const cookie = await loginAs(ADMIN)
    const email = `blocked-${uniq()}@example.com`

    // Create an admin we can log in as while it is live...
    const created = await $fetch<{ id: string }>('/api/post/admins', {
      method: 'POST',
      headers: { cookie },
      body: { name: 'Soon Archived Admin', email },
    })
    expect(created.id).toBeTruthy()

    // ...it can log in while live.
    const liveCookie = await loginAs(email)
    expect(liveCookie).toContain('=')

    // Now archive it.
    const del = await appFetch(`/api/delete/admins/${created.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(del.status).toBe(200)

    // The OTP send is rejected for an archived user (email released to null,
    // deletedAt set), so no OTP is ever issued and the login flow can't
    // complete. We drive the OTP-send endpoint directly (loginAs caches the
    // pre-archive session cookie, so it would not re-run the flow).
    const sendRes = await appFetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.88.0.1' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    })
    expect(
      sendRes.ok,
      'OTP send must be rejected for an archived user (blocked login)'
    ).toBe(false)

    // And sign-in itself can't resolve the archived user either: no OTP row
    // exists, so any attempt fails.
    const signInRes = await appFetch('/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.88.0.1' },
      body: JSON.stringify({ email, otp: '000000' }),
    })
    expect(signInRes.ok, 'sign-in must fail for an archived user').toBe(false)
  })

  it('metrics preserved: a soft-deleted COMPLETED ride still counts in completionRate and hours', async () => {
    const cookie = await loginAs(ADMIN)

    // Baseline metrics.
    const before = await $fetch<{ total: number; completed: number }>(
      '/api/get/metrics/completionRate',
      { headers: { cookie } }
    )
    const hoursBefore = await $fetch<{ totalHours: number }>(
      '/api/get/metrics/hours',
      { headers: { cookie } }
    )

    // Create a completed ride worth a known number of hours.
    const clients = await $fetch<ClientRow[]>('/api/get/clients', {
      headers: { cookie },
    })
    const someClient = clients[0]
    expect(someClient).toBeTruthy()

    const ride = await $fetch<{ id: string }>('/api/post/rides', {
      method: 'POST',
      headers: { cookie },
      body: {
        clientId: someClient!.id,
        pickup: { street: '1 Metric St', city: 'Dallas', state: 'TX', zip: '75001' },
        dropoff: { street: '2 Metric Ave', city: 'Dallas', state: 'TX', zip: '75002' },
        scheduledTime: new Date(Date.now() - 86400000).toISOString(),
      },
    })
    expect(ride.id).toBeTruthy()

    await $fetch(`/api/put/rides/${ride.id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { status: 'COMPLETED', totalRideTime: 2 },
    })

    const midHours = await $fetch<{ totalHours: number }>(
      '/api/get/metrics/hours',
      { headers: { cookie } }
    )
    expect(midHours.totalHours).toBeCloseTo(hoursBefore.totalHours + 2, 5)

    // Soft-delete the completed ride.
    const del = await appFetch(`/api/delete/rides/${ride.id}`, {
      method: 'DELETE',
      headers: { cookie },
    })
    expect(del.status).toBe(200)

    // It no longer shows in the active rides list...
    const rides = await $fetch<Array<{ id: string }>>('/api/get/rides', {
      headers: { cookie },
    })
    expect(rides.some((r) => r.id === ride.id)).toBe(false)

    // ...but the metrics still count it (historical preservation).
    const after = await $fetch<{ total: number; completed: number }>(
      '/api/get/metrics/completionRate',
      { headers: { cookie } }
    )
    expect(after.total, 'soft-deleted ride still counts toward total').toBe(before.total + 1)
    expect(after.completed, 'soft-deleted completed ride still counts as completed').toBe(
      before.completed + 1
    )

    const hoursAfter = await $fetch<{ totalHours: number }>(
      '/api/get/metrics/hours',
      { headers: { cookie } }
    )
    expect(hoursAfter.totalHours, 'soft-deleted ride hours preserved').toBeCloseTo(
      hoursBefore.totalHours + 2,
      5
    )
  })

  it('revokes sessions on soft-delete: an archived user\'s live cookie is rejected (decision #1)', async () => {
    const adminCookie = await loginAs(ADMIN)
    const email = `revoke-vol-${uniq()}@example.com`

    // Create a volunteer and log in as them, capturing a LIVE session cookie.
    const created = await $fetch<{ id: string; userId: string }>(
      '/api/post/volunteers',
      {
        method: 'POST',
        headers: { cookie: adminCookie },
        body: { name: 'Revoke Vol', email, status: 'AVAILABLE' },
      }
    )
    expect(created.id).toBeTruthy()

    const volCookie = await loginAs(email)

    // Probe a session+role-gated endpoint that does NOT re-check the volunteer
    // profile: GET /api/get/rides succeeds for any authenticated volunteer. This
    // isolates session validity (the global auth middleware) from the per-handler
    // deletedAt guards, so we're really testing session revocation.
    const okRes = await appFetch('/api/get/rides', {
      headers: { cookie: volCookie },
    })
    expect(okRes.status, 'live session should be accepted').toBe(200)

    // Admin soft-deletes the volunteer.
    const del = await appFetch(`/api/delete/volunteers/${created.id}`, {
      method: 'DELETE',
      headers: { cookie: adminCookie },
    })
    expect(del.status).toBe(200)

    // The SAME (previously valid) cookie must now be rejected at the auth layer —
    // hard delete used to cascade to the session table; soft delete must revoke
    // sessions too, or the archived user keeps full API access despite the
    // decision-#1 login block. Pre-fix the session survives, so this returns 200.
    const afterRes = await appFetch('/api/get/rides', {
      headers: { cookie: volCookie },
    })
    expect(
      afterRes.status,
      'archived user\'s stale cookie must be rejected (401)'
    ).toBe(401)

    // And no session rows remain for that user (direct DB read).
    const conn = db()
    try {
      const row = conn
        .prepare('SELECT COUNT(*) AS n FROM session WHERE userId = ?')
        .get(created.userId) as { n: number }
      expect(row.n, 'all sessions for the archived user must be deleted').toBe(0)
    } finally {
      conn.close()
    }
  })
})
