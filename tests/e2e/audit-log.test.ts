import { afterEach, describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import Database from 'better-sqlite3'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

type Ride = {
  id: string
  status: 'CREATED' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'
  volunteerId: string | null
}

type AuditLog = {
  id: string
  userId: string
  action: string
  targetType: string
  targetId: string | null
  details: unknown
  createdAt: string
}

// Read a single value straight from the throwaway test DB (same trick as
// tests/utils/auth.ts) so we can assert the acting user's id.
function userIdByEmail(email: string): string {
  const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db.prepare(`SELECT id FROM user WHERE email = ? LIMIT 1`).get(email) as
      | { id: string }
      | undefined
    if (!row) throw new Error(`no user row for ${email}`)
    return row.id
  } finally {
    db.close()
  }
}

async function getRides(cookie: string): Promise<Ride[]> {
  return await $fetch<Ride[]>('/api/get/rides', { headers: { cookie } })
}

// Rides cancelled here are restored to CREATED afterwards so the shared seed DB
// stays intact for other e2e files (mirrors ride-cancel.test.ts).
const touchedRideIds = new Set<string>()

afterEach(async () => {
  if (!touchedRideIds.size) return
  const cookie = await loginAs('reachtusharwani@gmail.com')
  for (const id of touchedRideIds) {
    await appFetch(`/api/put/rides/${id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ volunteerId: '', status: 'CREATED' }),
    })
  }
  touchedRideIds.clear()
})

describe('Audit logging system (issue #28)', () => {
  it('writes an audit row when an admin cancels a ride, readable via GET /api/get/audit', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    const ride = (await getRides(cookie)).find(
      (r) => r.status === 'CREATED' && !touchedRideIds.has(r.id),
    )
    expect(ride, 'seed should have an untouched CREATED ride').toBeTruthy()
    touchedRideIds.add(ride!.id)

    // Perform the logged action.
    const cancelled = await $fetch<Ride>(`/api/put/rides/${ride!.id}`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: { status: 'CANCELLED' },
    })
    expect(cancelled.status).toBe('CANCELLED')

    // Read the audit trail back through the admin endpoint (bounded, newest-first).
    const logs = await $fetch<AuditLog[]>('/api/get/audit', {
      headers: { cookie },
      query: { action: 'RIDE_CANCELLED' },
    })

    const entry = logs.find((l) => l.targetId === ride!.id)
    expect(entry, 'expected a RIDE_CANCELLED audit row for the cancelled ride').toBeTruthy()
    expect(entry!.action).toBe('RIDE_CANCELLED')
    expect(entry!.targetType).toBe('Ride')
    expect(entry!.targetId).toBe(ride!.id)
    // The acting user recorded is the logged-in admin.
    expect(entry!.userId).toBe(userIdByEmail('reachtusharwani@gmail.com'))
  })

  it('caps the result set (bounded, not unbounded)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const logs = await $fetch<AuditLog[]>('/api/get/audit', { headers: { cookie } })
    expect(Array.isArray(logs)).toBe(true)
    expect(logs.length).toBeLessThanOrEqual(100)
  })

  it('is admin-gated: a volunteer cannot read the audit log', async () => {
    const cookie = await loginAs('bob@example.com')
    await expect(
      $fetch('/api/get/audit', { headers: { cookie } }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('is admin-gated: an unauthenticated request is rejected', async () => {
    await expect($fetch('/api/get/audit')).rejects.toMatchObject({ statusCode: 401 })
  })
})
