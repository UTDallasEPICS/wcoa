import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Regression coverage for issue #32: POST /api/post/rides used to `await` the
// RIDE_CREATED broadcast before returning, so the HTTP response blocked on N
// sequential SMTP sends and a broadcast failure failed the whole create. The
// fix dispatches the broadcast fire-and-forget: the ride is created and returned
// immediately, and a broadcast error is swallowed in the background.
//
// Pinned via the fault-injection seam (#67): `x-test-fault: ride-broadcast`
// throws inside broadcastNotification.
//   - Pre-fix (awaited broadcast): the fault propagates -> create returns 500.
//   - Post-fix (fire-and-forget):  the fault is caught by .catch -> 200 + ride.

async function adminCookie() {
  return loginAs('reachtusharwani@gmail.com')
}

async function firstClientId(cookie: string): Promise<string> {
  const { items: clients } = await $fetch<{ items: Array<{ id: string }> }>(
    '/api/get/clients?pageSize=100',
    { headers: { cookie } }
  )
  expect(clients.length).toBeGreaterThan(0)
  return clients[0]!.id
}

function rideBody(clientId: string) {
  // Distinct street keeps the created rows easy to identify in the shared DB.
  const stamp = Date.now()
  return {
    clientId,
    pickup: {
      street: `${stamp} Broadcast Test Ave`,
      city: 'Richardson',
      state: 'TX',
      zip: '75080',
    },
    dropoff: {
      street: `${stamp} Broadcast Test Blvd`,
      city: 'Dallas',
      state: 'TX',
      zip: '75201',
    },
    scheduledTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'ride-broadcast-nonblocking regression',
  }
}

async function createRide(
  cookie: string,
  clientId: string,
  opts: { fault?: string } = {},
) {
  const headers: Record<string, string> = { cookie, 'content-type': 'application/json' }
  if (opts.fault) headers['x-test-fault'] = opts.fault
  const res = await appFetch('/api/post/rides', {
    method: 'POST',
    headers,
    body: JSON.stringify(rideBody(clientId)),
  })
  const body = (await res.json().catch(() => null)) as { id?: string } | null
  return { status: res.status, body }
}

describe('POST /api/post/rides non-blocking broadcast (#32)', () => {
  it('a broadcast fault does not fail ride creation (200 + ride created)', async () => {
    const cookie = await adminCookie()
    const clientId = await firstClientId(cookie)

    const { status, body } = await createRide(cookie, clientId, {
      fault: 'ride-broadcast',
    })

    // Pre-fix the awaited broadcast propagates the injected fault -> 500.
    // Post-fix the fire-and-forget broadcast swallows it -> 200 with the ride.
    expect(status).toBe(200)
    expect(body?.id).toBeTruthy()
  })

  it('a normal create (no fault) still returns 200 and creates the ride', async () => {
    const cookie = await adminCookie()
    const clientId = await firstClientId(cookie)

    const { status, body } = await createRide(cookie, clientId)
    expect(status).toBe(200)
    expect(body?.id).toBeTruthy()
  })
})
