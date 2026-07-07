import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch, setup } from '@nuxt/test-utils/e2e'
import { fileURLToPath } from 'node:url'
import { loginAs } from '../utils/auth'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
})

// Issue #12 (TOCTOU race): signup.ts read the ride, checked status in memory,
// then updated with `where: { id }` only. Two volunteers signing up at the same
// time could both pass the in-memory check, and the second would silently
// overwrite the first. The fix moves the precondition into the update's WHERE
// clause (`{ id, status: 'CREATED', volunteerId: null }`) and treats Prisma's
// P2025 as "already taken" (409).
//
// Caveat: the test DB uses the synchronous better-sqlite3 adapter, which
// serializes writes and does not yield mid-handler, so through the HTTP layer
// the pre-fix code never actually double-assigns (the loser's separate read
// already sees ASSIGNED and the in-memory pre-check returns 400). These tests
// therefore pin the *invariant* — exactly one winner, assignment never
// overwritten — which the WHERE-clause guard guarantees under any adapter that
// does interleave. See the PR body for the revert-check / code-review evidence.

type Ride = {
  id: string
  status: string
  volunteerId: string | null
}

async function rawSignup(rideId: string, cookie: string): Promise<number> {
  const res = await appFetch(`/api/post/rides/${rideId}/signup`, {
    method: 'POST',
    headers: { cookie },
  })
  return res.status
}

async function findCreatedRideId(adminCookie: string): Promise<string> {
  const rides = await $fetch<Ride[]>('/api/get/rides', { headers: { cookie: adminCookie } })
  const created = rides.find((r) => r.status === 'CREATED' && r.volunteerId === null)
  expect(created, 'seed should contain an available (CREATED) ride').toBeTruthy()
  return created!.id
}

describe('issue #12 — atomic ride signup', () => {
  it('two concurrent signups for the same ride: exactly one wins, no overwrite', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')
    const bobCookie = await loginAs('bob@example.com')
    const aliceCookie = await loginAs('alice@example.com')

    const rideId = await findCreatedRideId(adminCookie)

    // Fire two genuinely concurrent signups from two AVAILABLE volunteers.
    const results = await Promise.allSettled([
      rawSignup(rideId, bobCookie),
      rawSignup(rideId, aliceCookie),
    ])

    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value : 500))
    const okCount = statuses.filter((s) => s === 200).length
    const rejectedCount = statuses.filter((s) => s === 409 || s === 400).length

    // Exactly one winner; the loser must be cleanly rejected (not silently
    // overwriting the winner). The invariant that must hold no matter how the
    // two requests interleave: never two winners, never an overwrite.
    expect(okCount, `expected exactly one 200, got statuses ${statuses.join(',')}`).toBe(1)
    expect(rejectedCount, `expected exactly one 409/400, got statuses ${statuses.join(',')}`).toBe(1)

    // The final assignment must belong to whichever request returned 200, and
    // must never have been overwritten by the loser.
    const bobStatus = statuses[0]
    const winnerCookie = bobStatus === 200 ? bobCookie : aliceCookie
    const winnerVol = await $fetch<{ id: string }>('/api/get/volunteers/bySession', {
      headers: { cookie: winnerCookie },
    })

    const ride = await $fetch<Ride>(`/api/get/rides/byId/${rideId}`, {
      headers: { cookie: adminCookie },
    })
    expect(ride.status).toBe('ASSIGNED')
    expect(ride.volunteerId).toBe(winnerVol.id)
  })

  it('signing up for an already-ASSIGNED ride is rejected (deterministic guard)', async () => {
    const adminCookie = await loginAs('reachtusharwani@gmail.com')
    const bobCookie = await loginAs('bob@example.com')
    const aliceCookie = await loginAs('alice@example.com')

    const rideId = await findCreatedRideId(adminCookie)

    // Bob claims it first (deterministically).
    const first = await rawSignup(rideId, bobCookie)
    expect(first).toBe(200)

    // Alice now tries to claim the already-ASSIGNED ride — must be rejected,
    // never overwriting Bob's assignment.
    const second = await rawSignup(rideId, aliceCookie)
    expect(second === 409 || second === 400, `expected 409/400, got ${second}`).toBe(true)

    const bob = await $fetch<{ id: string }>('/api/get/volunteers/bySession', {
      headers: { cookie: bobCookie },
    })
    const ride = await $fetch<Ride>(`/api/get/rides/byId/${rideId}`, {
      headers: { cookie: adminCookie },
    })
    expect(ride.status).toBe('ASSIGNED')
    expect(ride.volunteerId).toBe(bob.id)
  })
})
