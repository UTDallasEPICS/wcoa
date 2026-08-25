// Open-source geocoding + routing helpers (no API key).
//
// Geocoding: Nominatim (nominatim.openstreetmap.org), OpenStreetMap-based.
//   We previously used Photon; it mis-ranked abbreviated street addresses (e.g.
//   "6001 W Plano Pkwy" matched a house number onto the wrong street ~4mi away),
//   which threw off both the autocomplete suggestions and the routed distance.
//   Nominatim parses structured US addresses far more accurately.
// Routing:   OSRM public demo (router.project-osrm.org).
//
// Both are best-effort public instances, so every call is wrapped to degrade
// gracefully (null / []) rather than throw. When MAPS_OFFLINE=1 (set by the e2e
// harness, tests/global-setup.ts) all outbound calls are skipped so the suite
// stays hermetic and deterministic — geocoding yields no results and routing
// yields null, exactly as a real outage would, without touching the network.
//
// Nominatim usage policy: send a real User-Agent and stay light (≤1 req/s). This
// app's volume is tiny — a couple admins, a 300ms-debounced autocomplete, and
// per-ride caching — so the public instance is fine. At heavy scale, self-host
// Nominatim (Docker, no key/limit) or move to a hosted OSM geocoder.
function offline(): boolean {
  return process.env.MAPS_OFFLINE === '1'
}

// Identify the app to Nominatim (policy requirement). Overridable so a deployment
// can supply its own contact string.
const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ?? 'wcoa-ride-app/1.0 (volunteer ride scheduling)'

// Bias results toward the org's service area (DFW / North Texas) and restrict to
// the US so an ambiguous name can't resolve to another country.
const NOMINATIM_VIEWBOX = '-97.0,33.3,-96.5,32.8'

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

interface NominatimResult {
  lat: string
  lon: string
  name?: string
  display_name?: string
  address?: Record<string, string>
}

// Turn a US state name into its 2-letter code. Nominatim usually hands us the
// ISO code directly (`ISO3166-2-lvl4` = "US-TX"); this is the fallback.
const STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC',
}

function stateCode(a: Record<string, string>): string {
  const iso = a['ISO3166-2-lvl4'] // e.g. "US-TX"
  if (iso?.startsWith('US-')) return iso.slice(3)
  const s = a.state ?? ''
  return STATE_ABBR[s.toLowerCase()] ?? s
}

export async function geocodeSearch(query: string, limit = 5): Promise<GeocodeResult[]> {
  const q = (query ?? '').trim()
  if (!q) return []
  if (offline()) return [OFFLINE_RESULT]
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', q)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('countrycodes', 'us')
  url.searchParams.set('viewbox', NOMINATIM_VIEWBOX)
  try {
    const res = await $fetch<NominatimResult[]>(url.toString(), {
      headers: { 'User-Agent': NOMINATIM_UA },
    })
    return (res ?? [])
      .map((r) => {
        const a = r.address ?? {}
        const lat = parseFloat(r.lat)
        const lon = parseFloat(r.lon)
        // A named POI (hospital, campus) carries the label in `name`; a plain
        // address has house_number + road.
        const road = a.road || a.pedestrian || a.footway || a.path || ''
        const street = [a.house_number, road].filter(Boolean).join(' ') || r.name || ''
        const city =
          a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county || ''
        const state = stateCode(a)
        const zip = a.postcode || ''
        const label = [street, city, state, zip].filter(Boolean).join(', ')
        return { label, address: { street, city, state, zip }, lat, lon } as GeocodeResult
      })
      .filter((r) => (r.address.street || r.label) && Number.isFinite(r.lat))
  } catch (err) {
    console.error('geocodeSearch failed', err)
    return []
  }
}

export async function geocodeOne(query: string): Promise<{ lat: number; lon: number } | null> {
  const [first] = await geocodeSearch(query, 1)
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
