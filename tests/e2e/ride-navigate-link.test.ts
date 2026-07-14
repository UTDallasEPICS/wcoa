import { describe, expect, it } from 'vitest'
import { $fetch, fetch as appFetch } from '@nuxt/test-utils/e2e'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'
import { buildMapsDeepLink } from '../../app/utils/mapsLink'

await bootShared()

// Issue #26: the ride details page must expose a prominent "Navigate" deep-link
// near the map/addresses that hands off to the phone's native maps app using a
// universal Google Maps directions URL (origin = pickup, destination = dropoff,
// URL-encoded). The ride details page is server-rendered (ride data is fetched
// via useFetch during SSR), so the anchor + its href appear in the initial HTML.

describe('ride details Navigate deep-link (#26)', () => {
  it('renders a maps directions deep-link with encoded pickup/dropoff', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')

    const { items: rides } = await $fetch<{
      items: Array<{ id: string; pickupDisplay: string; dropoffDisplay: string }>
    }>('/api/get/rides?pageSize=100', { headers: { cookie } })
    expect(rides.length).toBeGreaterThan(0)

    const ride = rides[0]!
    const res = await appFetch(`/rides/${ride.id}`, { headers: { cookie } })
    expect(res.status).toBe(200)
    const html = await res.text()

    const expectedHref = buildMapsDeepLink(ride.pickupDisplay, ride.dropoffDisplay)
    // In an HTML attribute the raw "&" query separators are entity-escaped to
    // "&amp;"; the browser unescapes them back to the exact expectedHref.
    const escapedHref = expectedHref.replace(/&/g, '&amp;')

    // The universal directions base must be present.
    expect(html).toContain('https://www.google.com/maps/dir/?')
    // The full, correctly-built href (with encoded origin/destination) must be
    // in the server-rendered HTML.
    expect(html).toContain(escapedHref)
    // The addresses must actually be encoded (raw spaces would break the link).
    expect(expectedHref).toContain(encodeURIComponent(ride.pickupDisplay).replace(/%20/g, '+'))
  })

  it('builds a correct universal directions URL from address components', () => {
    const url = buildMapsDeepLink('1501 H Ave, Plano, TX', '9 Cowboys Way, Frisco, TX')
    expect(url.startsWith('https://www.google.com/maps/dir/?')).toBe(true)
    const parsed = new URL(url)
    expect(parsed.searchParams.get('api')).toBe('1')
    expect(parsed.searchParams.get('origin')).toBe('1501 H Ave, Plano, TX')
    expect(parsed.searchParams.get('destination')).toBe('9 Cowboys Way, Frisco, TX')
    // Raw commas/spaces must be percent/plus-encoded in the wire format.
    expect(url).not.toContain(' ')
  })

  it('omits missing origin/destination without emitting empty params', () => {
    expect(buildMapsDeepLink('A', null)).toBe('https://www.google.com/maps/dir/?api=1&origin=A')
    expect(buildMapsDeepLink(undefined, 'B')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=B',
    )
  })
})
