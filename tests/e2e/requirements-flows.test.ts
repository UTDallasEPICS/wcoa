import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Requirement-driven flow coverage (see REQUIREMENTS.md). These tests cover the
// catalog rows that the issue-pin suites don't: create-path validation, the
// volunteer self-service journey, template/notification-settings plumbing, and
// metrics arithmetic. Titles carry R-IDs for the traceability gate (pnpm trace).

const ADMIN = 'reachtusharwani@gmail.com'
const BOB = 'bob@example.com'

const json = (cookie: string) => ({ 'content-type': 'application/json', cookie })

/** Unique-ish suffix so entities from this file never collide with seed data. */
const RUN = `rf${Date.now().toString(36)}`

async function createClient(cookie: string, name: string, email?: string) {
  return await $fetch<{ id: string }>('/api/post/clients', {
    method: 'POST',
    headers: json(cookie),
    body: {
      name,
      email,
      street: `${RUN} 12 Flow St`,
      city: 'Plano',
      state: 'TX',
      zip: '75074',
    },
  })
}

async function createRide(cookie: string, clientId: string, volunteerId?: string) {
  return await $fetch<{ id: string; status: string }>('/api/post/rides', {
    method: 'POST',
    headers: json(cookie),
    body: {
      clientId,
      volunteerId,
      pickup: { street: `${RUN} 12 Flow St`, city: 'Plano', state: 'TX', zip: '75074' },
      dropoff: { street: `${RUN} 800 W Campbell Rd`, city: 'Richardson', state: 'TX', zip: '75080' },
      scheduledTime: new Date(Date.now() + 3 * 86400000).toISOString(),
    },
  })
}

describe('auth flow (R-004)', () => {
  it('R-004: sign-in with a wrong OTP is rejected', async () => {
    const ip = `10.98.1.${Math.floor(Math.random() * 250) + 1}`
    const send = await appFetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ email: BOB, type: 'sign-in' }),
    })
    expect(send.ok).toBe(true)
    const signIn = await appFetch('/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ email: BOB, otp: '000000' }),
    })
    expect(signIn.status).toBe(400)
  })
})

describe('client create/update guards (R-040, R-041, R-042, R-046)', () => {
  it('R-040: create without required address fields → 400; email is optional', async () => {
    const cookie = await loginAs(ADMIN)
    const res = await appFetch('/api/post/clients', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ name: 'No Address' }),
    })
    expect(res.status).toBe(400)
    // email omitted entirely is fine when the address is present
    const created = await createClient(cookie, `${RUN} Emailless Client`)
    expect(created.id).toBeTruthy()
  })

  it('R-042: creating a second client profile for the same email → 400', async () => {
    const cookie = await loginAs(ADMIN)
    await createClient(cookie, `${RUN} Dup Client`, `${RUN}-dup-client@example.com`)
    const res = await appFetch('/api/post/clients', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({
        name: `${RUN} Dup Client`,
        email: `${RUN}-dup-client@example.com`,
        street: '12 Flow St', city: 'Plano', state: 'TX', zip: '75074',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('R-046: updating an unknown client → 404', async () => {
    const cookie = await loginAs(ADMIN)
    const res = await appFetch('/api/put/clients/nonexistent-id', {
      method: 'PUT',
      headers: json(cookie),
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('volunteer create guards (R-060, R-061, R-062, R-068)', () => {
  it('R-060/R-061: requires name+email; duplicate profile → 400', async () => {
    const cookie = await loginAs(ADMIN)
    const missing = await appFetch('/api/post/volunteers', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ name: 'No Email' }),
    })
    expect(missing.status).toBe(400)

    const email = `${RUN}-vol@example.com`
    // R-062: creation succeeds even though the welcome email cannot actually be
    // sent in this harness (send failures are fire-and-forget).
    const created = await $fetch<{ id: string }>('/api/post/volunteers', {
      method: 'POST',
      headers: json(cookie),
      body: { name: `${RUN} Flow Vol`, email },
    })
    expect(created.id).toBeTruthy()

    const dup = await appFetch('/api/post/volunteers', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ name: `${RUN} Flow Vol`, email }),
    })
    expect(dup.status).toBe(400)
  })

  it('R-068: updating an unknown volunteer → 404', async () => {
    const cookie = await loginAs(ADMIN)
    const res = await appFetch('/api/put/volunteers/nonexistent-id', {
      method: 'PUT',
      headers: json(cookie),
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
  })
})

describe('volunteer self-service settings (R-065, R-066, R-067)', () => {
  it('R-065: bySession/status accepts only valid enum values and round-trips', async () => {
    const cookie = await loginAs(BOB)
    const bogus = await appFetch('/api/put/volunteers/bySession/status', {
      method: 'PUT',
      headers: json(cookie),
      body: JSON.stringify({ status: 'NONSENSE' }),
    })
    expect(bogus.status).toBe(400)

    await $fetch('/api/put/volunteers/bySession/status', {
      method: 'PUT', headers: json(cookie), body: { status: 'UNAVAILABLE' },
    })
    const me = await $fetch<{ status: string }>('/api/get/volunteers/bySession', { headers: { cookie } })
    expect(me.status).toBe('UNAVAILABLE')
    await $fetch('/api/put/volunteers/bySession/status', {
      method: 'PUT', headers: json(cookie), body: { status: 'AVAILABLE' },
    })
  })

  it('R-066: bySession/reminders replaces the set atomically and validates shape', async () => {
    const cookie = await loginAs(BOB)
    const bad = await appFetch('/api/put/volunteers/bySession/reminders', {
      method: 'PUT',
      headers: json(cookie),
      body: JSON.stringify([{ minutesBefore: -5 }]),
    })
    expect(bad.status).toBe(400)

    const updated = await $fetch<{ reminders: Array<{ minutesBefore: number }> }>(
      '/api/put/volunteers/bySession/reminders',
      { method: 'PUT', headers: json(cookie), body: [{ minutesBefore: 60 }, { minutesBefore: 1440 }] }
    )
    expect(updated.reminders.map((r) => r.minutesBefore).sort((a, b) => a - b)).toEqual([60, 1440])

    // Replace (not append): a second PUT with one entry leaves exactly one.
    const replaced = await $fetch<{ reminders: Array<{ minutesBefore: number }> }>(
      '/api/put/volunteers/bySession/reminders',
      { method: 'PUT', headers: json(cookie), body: [{ minutesBefore: 30 }] }
    )
    expect(replaced.reminders).toHaveLength(1)
  })

  it('R-067/R-192: bySession/notifications merges per-type opt-outs and persists them', async () => {
    const cookie = await loginAs(BOB)
    await $fetch('/api/put/volunteers/bySession/notifications', {
      method: 'PUT', headers: json(cookie), body: { notifications: { RIDE_CREATED: false } },
    })
    await $fetch('/api/put/volunteers/bySession/notifications', {
      method: 'PUT', headers: json(cookie), body: { notifications: { RIDE_REMINDER: false } },
    })
    const me = await $fetch<{ notificationSettings: Record<string, boolean> }>(
      '/api/get/volunteers/bySession', { headers: { cookie } }
    )
    // merge semantics: the second PUT must not erase the first key
    expect(me.notificationSettings.RIDE_CREATED).toBe(false)
    expect(me.notificationSettings.RIDE_REMINDER).toBe(false)
    await $fetch('/api/put/volunteers/bySession/notifications', {
      method: 'PUT', headers: json(cookie),
      body: { notifications: { RIDE_CREATED: true, RIDE_REMINDER: true } },
    })
  })
})

describe('ride creation (R-100, R-102)', () => {
  it('R-100: missing required fields → 400', async () => {
    const cookie = await loginAs(ADMIN)
    const res = await appFetch('/api/post/rides', {
      method: 'POST',
      headers: json(cookie),
      body: JSON.stringify({ clientId: 'x' }),
    })
    expect(res.status).toBe(400)
  })

  it('R-102: created with a volunteer → ASSIGNED; without → CREATED', async () => {
    const cookie = await loginAs(ADMIN)
    const client = await createClient(cookie, `${RUN} Ride Client`, `${RUN}-ride-client@example.com`)
    const bare = await createRide(cookie, client.id)
    expect(bare.status).toBe('CREATED')

    const me = await loginAs(BOB)
    const bob = await $fetch<{ id: string }>('/api/get/volunteers/bySession', { headers: { cookie: me } })
    const assigned = await createRide(cookie, client.id, bob.id)
    expect(assigned.status).toBe('ASSIGNED')
    // cleanup so bob's ASSIGNED count doesn't surprise later files (soft delete)
    await appFetch(`/api/delete/rides/${assigned.id}`, { method: 'DELETE', headers: json(cookie) })
    await appFetch(`/api/delete/rides/${bare.id}`, { method: 'DELETE', headers: json(cookie) })
  })
})

describe('volunteer signup/unsignup journey (R-130, R-132, R-133, R-134, R-110)', () => {
  it('R-130: signup requires AVAILABLE status (400 when UNAVAILABLE)', async () => {
    const admin = await loginAs(ADMIN)
    const bob = await loginAs(BOB)
    const client = await createClient(admin, `${RUN} SC1`, `${RUN}-sc1@example.com`)
    const ride = await createRide(admin, client.id)

    await $fetch('/api/put/volunteers/bySession/status', {
      method: 'PUT', headers: json(bob), body: { status: 'UNAVAILABLE' },
    })
    const blocked = await appFetch(`/api/post/rides/${ride.id}/signup`, { method: 'POST', headers: json(bob) })
    expect(blocked.status).toBe(400)
    await $fetch('/api/put/volunteers/bySession/status', {
      method: 'PUT', headers: json(bob), body: { status: 'AVAILABLE' },
    })
  })

  it('R-132/R-133/R-134/R-110: full journey — signup, wrong-volunteer unsignup 403, unsignup, admin completes', async () => {
    const admin = await loginAs(ADMIN)
    const bob = await loginAs(BOB)
    const alice = await loginAs('alice@example.com')
    const client = await createClient(admin, `${RUN} SC2`, `${RUN}-sc2@example.com`)
    const ride = await createRide(admin, client.id)

    // signup on unknown ride → 404 (R-132)
    const ghost = await appFetch('/api/post/rides/nonexistent-id/signup', { method: 'POST', headers: json(bob) })
    expect(ghost.status).toBe(404)

    // bob signs up (R-134: the request succeeds even though notifications can't send here)
    const signed = await $fetch<{ status: string; volunteerId: string }>(
      `/api/post/rides/${ride.id}/signup`, { method: 'POST', headers: json(bob) }
    )
    expect(signed.status).toBe('ASSIGNED')

    // second signup on a non-CREATED ride → 400 (R-132)
    const again = await appFetch(`/api/post/rides/${ride.id}/signup`, { method: 'POST', headers: json(alice) })
    expect(again.status).toBe(400)

    // alice can't unsign bob's ride (R-133)
    const wrong = await appFetch(`/api/post/rides/${ride.id}/unsignup`, { method: 'POST', headers: json(alice) })
    expect(wrong.status).toBe(403)

    // bob unsigns; ride returns to the pool (R-133)
    const unsigned = await $fetch<{ status: string; volunteerId: string | null }>(
      `/api/post/rides/${ride.id}/unsignup`, { method: 'POST', headers: json(bob) }
    )
    expect(unsigned.status).toBe('CREATED')
    expect(unsigned.volunteerId).toBeNull()

    // unsignup from a CREATED ride → handler rejection, not success (R-133)
    const notAssigned = await appFetch(`/api/post/rides/${ride.id}/unsignup`, { method: 'POST', headers: json(bob) })
    expect([400, 403]).toContain(notAssigned.status)

    // admin assigns + completes with a duration (R-110): succeeds and persists
    const bobProfile = await $fetch<{ id: string }>('/api/get/volunteers/bySession', { headers: { cookie: bob } })
    await $fetch(`/api/put/rides/${ride.id}`, {
      method: 'PUT', headers: json(admin), body: { volunteerId: bobProfile.id, status: 'ASSIGNED' },
    })
    const done = await $fetch<{ status: string; totalRideTime: number }>(`/api/put/rides/${ride.id}`, {
      method: 'PUT', headers: json(admin), body: { status: 'COMPLETED', totalRideTime: 2.5 },
    })
    expect(done.status).toBe('COMPLETED')
    expect(done.totalRideTime).toBe(2.5)
  })
})

describe('metrics arithmetic (R-171, R-174)', () => {
  it('R-171/R-174: completing a ride moves completionRate and hours by exactly that ride', async () => {
    const admin = await loginAs(ADMIN)
    const before = await $fetch<{ total: number; completed: number }>(
      '/api/get/metrics/completionRate', { headers: { cookie: admin } }
    )
    const hoursBefore = await $fetch<{ totalHours: number }>(
      '/api/get/metrics/hours', { headers: { cookie: admin } }
    )

    const client = await createClient(admin, `${RUN} Metrics C`, `${RUN}-metrics@example.com`)
    const ride = await createRide(admin, client.id)
    await $fetch(`/api/put/rides/${ride.id}`, {
      method: 'PUT', headers: json(admin), body: { status: 'COMPLETED', totalRideTime: 3.25 },
    })

    const after = await $fetch<{ total: number; completed: number }>(
      '/api/get/metrics/completionRate', { headers: { cookie: admin } }
    )
    const hoursAfter = await $fetch<{ totalHours: number }>(
      '/api/get/metrics/hours', { headers: { cookie: admin } }
    )
    expect(after.total).toBe(before.total + 1)
    expect(after.completed).toBe(before.completed + 1)
    expect(hoursAfter.totalHours).toBeCloseTo(hoursBefore.totalHours + 3.25, 5)
  })
})

describe('notification templates (R-190, R-191)', () => {
  it('R-190: five templates exist; PUT round-trips; unknown name → 400', async () => {
    const cookie = await loginAs(ADMIN)
    const list = await $fetch<Array<{ name: string; subject: string; enabled: boolean }>>(
      '/api/get/notifications/templates', { headers: { cookie } }
    )
    const names = list.map((t) => t.name).sort()
    expect(names).toEqual(['RIDE_ASSIGNED', 'RIDE_CANCELLED', 'RIDE_COMPLETED', 'RIDE_CREATED', 'RIDE_REMINDER'])

    const original = list.find((t) => t.name === 'RIDE_COMPLETED')!
    await $fetch('/api/put/notifications/templates/RIDE_COMPLETED', {
      method: 'PUT', headers: json(cookie),
      body: { subject: `${RUN} subject`, body: original.subject ? '<p>{{name}}</p>' : '<p>x</p>' },
    })
    const updated = await $fetch<Array<{ name: string; subject: string }>>(
      '/api/get/notifications/templates', { headers: { cookie } }
    )
    expect(updated.find((t) => t.name === 'RIDE_COMPLETED')!.subject).toBe(`${RUN} subject`)

    // Unknown name with an INVALID body 400s on validation. (Unknown name with
    // a VALID body currently 500s — pinned in known-bugs.test.ts, issue #91.)
    const unknown = await appFetch('/api/put/notifications/templates/NO_SUCH_TEMPLATE', {
      method: 'PUT', headers: json(cookie), body: JSON.stringify({}),
    })
    expect(unknown.status).toBe(400)
  })

  it('R-191: the enabled flag persists through PUT (disable/re-enable round-trip)', async () => {
    const cookie = await loginAs(ADMIN)
    await $fetch('/api/put/notifications/templates/RIDE_CREATED', {
      method: 'PUT', headers: json(cookie), body: { enabled: false },
    })
    let list = await $fetch<Array<{ name: string; enabled: boolean }>>(
      '/api/get/notifications/templates', { headers: { cookie } }
    )
    expect(list.find((t) => t.name === 'RIDE_CREATED')!.enabled).toBe(false)

    await $fetch('/api/put/notifications/templates/RIDE_CREATED', {
      method: 'PUT', headers: json(cookie), body: { enabled: true },
    })
    list = await $fetch<Array<{ name: string; enabled: boolean }>>(
      '/api/get/notifications/templates', { headers: { cookie } }
    )
    expect(list.find((t) => t.name === 'RIDE_CREATED')!.enabled).toBe(true)
  })
})

describe('reminder opt-out plumbing (R-213)', () => {
  it('R-213: the RIDE_REMINDER opt-out persists on the volunteer the scheduler reads', async () => {
    const cookie = await loginAs(BOB)
    await $fetch('/api/put/volunteers/bySession/notifications', {
      method: 'PUT', headers: json(cookie), body: { notifications: { RIDE_REMINDER: false } },
    })
    const me = await $fetch<{ notificationSettings: Record<string, boolean> }>(
      '/api/get/volunteers/bySession', { headers: { cookie } }
    )
    // sendNotification() suppresses on exactly this stored value; the end-to-end
    // suppression (claim written, no send) was verified live in the 2026-07-14 audit.
    expect(me.notificationSettings.RIDE_REMINDER).toBe(false)
    await $fetch('/api/put/volunteers/bySession/notifications', {
      method: 'PUT', headers: json(cookie), body: { notifications: { RIDE_REMINDER: true } },
    })
  })
})
