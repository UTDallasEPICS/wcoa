import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Regression coverage for issue #16: address upserts did not normalize casing
// or whitespace, so "123 Main St", "123 main st " etc. missed the
// @@unique([street, city, state, zip]) constraint and each spawned a
// near-duplicate Address row. The fix normalizes fields before the upsert so
// equivalent addresses collapse to a single row.

async function adminCookie() {
  return loginAs('reachtusharwani@gmail.com')
}

// Unique street token per run so we never collide with seeded addresses.
function uniqueStreet(): string {
  return `${Math.floor(Math.random() * 1e9)} Norm Test Ave`
}

async function createRide(cookie: string, street: string) {
  return $fetch<{ pickupAddressId: string }>('/api/post/rides', {
    method: 'POST',
    headers: { cookie },
    body: {
      clientId: (
        await $fetch<{ items: Array<{ id: string }> }>('/api/get/clients?pageSize=100', {
          headers: { cookie },
        })
      ).items[0]!.id,
      pickup: { street, city: 'Dallas', state: 'TX', zip: '75080' },
      dropoff: { street: '999 Dropoff Rd', city: 'Dallas', state: 'TX', zip: '75080' },
      scheduledTime: new Date(Date.now() + 86_400_000).toISOString(),
    },
  })
}

describe('address normalization on upsert (#16)', () => {
  it('collapses case/whitespace-variant pickup addresses to a single Address row', async () => {
    const cookie = await adminCookie()
    const baseStreet = uniqueStreet()

    // Same address typed two different ways: mixed case + trailing whitespace.
    const rideA = await createRide(cookie, baseStreet) // e.g. "123 Norm Test Ave"
    const rideB = await createRide(cookie, `  ${baseStreet.toLowerCase()}  `) // "  123 norm test ave  "

    // Both rides must resolve to the SAME Address row (pre-fix: two distinct ids).
    expect(rideB.pickupAddressId).toBe(rideA.pickupAddressId)

    // And the addresses search endpoint must find exactly one matching row.
    const searchToken = baseStreet.split(' ')[0]! // the numeric prefix, unique to this run
    const matches = await $fetch<Array<{ id: string }>>(
      `/api/get/addresses?search=${encodeURIComponent(searchToken)}`,
      { headers: { cookie } }
    )
    expect(matches.length).toBe(1)
    expect(matches[0]!.id).toBe(rideA.pickupAddressId)
  })
})
