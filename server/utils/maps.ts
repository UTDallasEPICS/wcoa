// Open-source geocoding + routing helpers (no API key).
//
// Geocoding: Photon (photon.komoot.io), OpenStreetMap-based.
// Routing:   OSRM public demo (router.project-osrm.org).
//
// Both are best-effort public instances, so every call is wrapped to degrade
// gracefully (null / []) rather than throw. When MAPS_OFFLINE=1 (set by the e2e
// harness, tests/global-setup.ts) all outbound calls are skipped so the suite
// stays hermetic and deterministic — geocoding yields no results and routing
// yields null, exactly as a real outage would, without touching the network.
function offline(): boolean {
  return process.env.MAPS_OFFLINE === '1'
}

export interface GeocodeResult {
  label: string
  address: { street: string; city: string; state: string; zip: string }
  lat: number
  lon: number
}

// Deterministic result returned in offline (test) mode so the address
// autocomplete + geocode endpoint stay exercisable without a network call.
const OFFLINE_RESULT: GeocodeResult = {
  label: 'Test Address, Plano, TX, 75000',
  address: { street: 'Test Address', city: 'Plano', state: 'TX', zip: '75000' },
  lat: 33.0,
  lon: -96.7,
}

export async function photonSearch(query: string, limit = 5): Promise<GeocodeResult[]> {
  const q = (query ?? '').trim()
  if (!q) return []
  if (offline()) return [OFFLINE_RESULT]
  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('lang', 'en')
  // Bias toward the org's service area (North Texas).
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
        return { label, address: { street, city, state, zip }, lat, lon } as GeocodeResult
      })
      .filter((r) => (r.address.street || r.label) && Number.isFinite(r.lat))
  } catch (err) {
    console.error('photonSearch failed', err)
    return []
  }
}

export async function geocodeOne(query: string): Promise<{ lat: number; lon: number } | null> {
  const [first] = await photonSearch(query, 1)
  return first ? { lat: first.lat, lon: first.lon } : null
}

export async function osrmRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): Promise<{
  durationSec: number
  distanceMeters: number
  geometry: number[][] | null
} | null> {
  if (offline()) return null
  // overview=full + geometries=geojson returns the drivable path as a GeoJSON
  // LineString ([lon,lat] pairs) so the map can draw the route.
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`
  try {
    const res = await $fetch<{
      code?: string
      routes?: { duration: number; distance: number; geometry?: { coordinates?: number[][] } }[]
    }>(url)
    const route = res?.routes?.[0]
    if (res?.code !== 'Ok' || !route) return null
    return {
      durationSec: route.duration,
      distanceMeters: route.distance,
      geometry: route.geometry?.coordinates ?? null,
    }
  } catch (err) {
    console.error('osrmRoute failed', err)
    return null
  }
}

// Seconds -> "9 min" / "1 hr 5 min".
export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

// Meters -> "5.7 mi" (US units for the North Texas org).
export function formatDistance(meters: number): string {
  return `${(meters / 1609.344).toFixed(1)} mi`
}
