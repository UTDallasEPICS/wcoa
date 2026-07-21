// Open-source address autocomplete/verification via Photon (photon.komoot.io),
// an OpenStreetMap-based geocoder — no API key. Used by the create-ride address
// field (AddressField.vue). Admin-only, matching the sibling address lookup
// (server/api/get/addresses): the create form is admin-only and this keeps the
// proxy from being an open geocoding relay.
//
// Returns the same shape as /api/get/addresses ({ label, address }) plus
// coordinates, so the client can reuse the picker and (later) plot the point.
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const q = ((getQuery(event).q as string) || '').trim()
  // Photon wants a few characters to return anything useful.
  if (q.length < 3) return []

  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '5')
  url.searchParams.set('lang', 'en')
  // Bias results toward the org's service area (North Texas) so local matches
  // rank first; results elsewhere still appear.
  url.searchParams.set('lat', '32.99')
  url.searchParams.set('lon', '-96.75')

  try {
    const res = await $fetch<{ features?: any[] }>(url.toString())
    return (res?.features ?? [])
      .map((f) => {
        const p = f.properties ?? {}
        const [lon, lat] = f.geometry?.coordinates ?? []
        const street = [p.housenumber, p.street || p.name].filter(Boolean).join(' ') || p.name || ''
        const city = p.city || p.town || p.village || p.county || ''
        const state = p.state || ''
        const zip = p.postcode || ''
        const label = [street, city, state, zip].filter(Boolean).join(', ')
        return { label, address: { street, city, state, zip }, lat, lon }
      })
      .filter((r) => r.address.street || r.label)
  } catch (err) {
    // Best-effort: on any failure (network, rate limit) return no suggestions so
    // the field falls back to manual entry rather than erroring.
    console.error('Geocode (Photon) failed', err)
    return []
  }
})
