import { describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Regression coverage for issue #57 (follow-up to #16). #16 Title-Cased address
// fields before the upsert to dedup case/whitespace variants, which mangled the
// stored DISPLAY value for acronyms/directionals/mixed-case:
//   "123 NW 5th Ave" -> "123 Nw 5th Ave"
// The Address row backs Client.homeAddress on the people page, so this is a
// visible regression. The fix stores the original-cased fields for display and
// dedups on a separate lowercased `matchKey`.

async function adminCookie() {
  return loginAs('reachtusharwani@gmail.com')
}

// Unique per run so we never collide with seeded/other-test addresses. The
// literal "NW" directional is the thing Title-Case mangles into "Nw".
function uniqueStreet(): string {
  return `123 NW ${Math.floor(Math.random() * 1e9)}th Ave`
}

interface ClientRow {
  id: string
  homeAddressId: string
  homeAddress: { id: string; street: string }
}

async function createClient(cookie: string, street: string, email: string) {
  return $fetch<ClientRow>('/api/post/clients', {
    method: 'POST',
    headers: { cookie },
    body: { name: 'MatchKey Test', email, street, city: 'Dallas', state: 'TX', zip: '75080' },
  })
}

describe('address matchKey preserves display casing + dedups (#57)', () => {
  it('stores the ORIGINAL casing of an acronym/directional street for display', async () => {
    const cookie = await adminCookie()
    const street = uniqueStreet() // e.g. "123 NW 5th Ave"
    const email = `matchkey-${Math.floor(Math.random() * 1e9)}@example.com`

    const created = await createClient(cookie, street, email)

    // Read back via the admin people/clients roster endpoint.
    const roster = await $fetch<ClientRow[]>('/api/get/clients', { headers: { cookie } })
    const row = roster.find((c) => c.id === created.id)!
    expect(row).toBeTruthy()

    // Pre-fix this returned the Title-Cased "123 Nw ...th Ave" (the "NW"
    // directional mangled to "Nw"). Post-fix the original casing is preserved.
    expect(row.homeAddress.street).toBe(street)
    expect(row.homeAddress.street).not.toContain(' Nw ')
  })

  it('still dedups case/whitespace variants onto a single Address row', async () => {
    const cookie = await adminCookie()
    const street = uniqueStreet()
    const emailA = `matchkey-${Math.floor(Math.random() * 1e9)}@example.com`

    const clientA = await createClient(cookie, street, emailA)

    // Same address, different casing + extra internal/edge whitespace, used as a
    // ride pickup. It must resolve to the SAME Address row (same matchKey).
    const messyVariant = `  ${street.toLowerCase().replace(/ /g, '   ')}  `
    const ride = await $fetch<{ pickupAddressId: string }>('/api/post/rides', {
      method: 'POST',
      headers: { cookie },
      body: {
        clientId: clientA.id,
        pickup: { street: messyVariant, city: 'DALLAS', state: 'tx', zip: '75080' },
        dropoff: { street: '999 Dropoff Rd', city: 'Dallas', state: 'TX', zip: '75080' },
        scheduledTime: new Date(Date.now() + 86_400_000).toISOString(),
      },
    })

    expect(ride.pickupAddressId).toBe(clientA.homeAddressId)
  })
})
