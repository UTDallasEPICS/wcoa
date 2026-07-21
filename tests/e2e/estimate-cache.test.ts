import { afterEach, describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import Database from 'better-sqlite3'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #14: GET /api/get/rides/estimate/:id must serve a cached
// distance/duration (+ coordinates) from the Ride record instead of geocoding +
// routing on every load. The harness runs maps offline (MAPS_OFFLINE=1): a cache
// MISS geocodes a deterministic canned point but routing is offline, so it
// returns the route-unavailable sentinel + nulls. Populating the cache columns
// directly proves a cache HIT returns the cached values with error: null, and
// that the cache is invalidated on address change.
const MISS_ERROR = "Couldn't calculate a route for this trip."

function db(): Database.Database {
  const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
  return new Database(dbPath)
}

interface EstimateResponse {
  duration: string | null
  distance: string | null
  durationValue: number | null
  distanceValue: number | null
  pickupLat: number | null
  pickupLng: number | null
  dropoffLat: number | null
  dropoffLng: number | null
  routeGeometry: number[][] | null
  error: string | null
}

// Canned OSRM-style geometry ([lon,lat][]) stored as JSON in the cache.
const ROUTE_GEOMETRY: number[][] = [
  [-96.7, 33.02],
  [-96.71, 32.99],
  [-96.73, 32.95],
]

// Track rows we mutate so each test leaves the shared DB as it found it.
const touched: string[] = []

function firstRideId(): string {
  const conn = db()
  try {
    const row = conn.prepare(`SELECT id FROM ride LIMIT 1`).get() as { id: string }
    return row.id
  } finally {
    conn.close()
  }
}

function populateCache(id: string): void {
  const conn = db()
  try {
    conn
      .prepare(
        `UPDATE ride SET cachedDistanceText = ?, cachedDistanceValue = ?,
           cachedDurationText = ?, cachedDurationValue = ?,
           cachedPickupLat = ?, cachedPickupLng = ?,
           cachedDropoffLat = ?, cachedDropoffLng = ?,
           cachedRouteGeometry = ?, estimatedAt = ?
         WHERE id = ?`
      )
      .run(
        '12.3 mi',
        19795,
        '18 mins',
        1080,
        33.02,
        -96.7,
        32.95,
        -96.73,
        JSON.stringify(ROUTE_GEOMETRY),
        new Date().toISOString(),
        id
      )
    touched.push(id)
  } finally {
    conn.close()
  }
}

function clearCache(id: string): void {
  const conn = db()
  try {
    conn
      .prepare(
        `UPDATE ride SET cachedDistanceText = NULL, cachedDistanceValue = NULL,
           cachedDurationText = NULL, cachedDurationValue = NULL,
           cachedPickupLat = NULL, cachedPickupLng = NULL,
           cachedDropoffLat = NULL, cachedDropoffLng = NULL,
           cachedRouteGeometry = NULL, estimatedAt = NULL
         WHERE id = ?`
      )
      .run(id)
  } finally {
    conn.close()
  }
}

afterEach(() => {
  while (touched.length) clearCache(touched.pop()!)
})

describe('ride estimate caching (issue #14)', () => {
  it('serves the cached estimate without calling the Maps API', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const id = firstRideId()
    populateCache(id)

    const res = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${id}`, {
      headers: { cookie },
    })

    expect(res.error).toBe(null)
    expect(res.distance).toBe('12.3 mi')
    expect(res.distanceValue).toBe(19795)
    expect(res.duration).toBe('18 mins')
    expect(res.durationValue).toBe(1080)
    // Coordinates are cached + served alongside the estimate (for the map).
    expect(res.pickupLat).toBe(33.02)
    expect(res.pickupLng).toBe(-96.7)
    expect(res.dropoffLat).toBe(32.95)
    expect(res.dropoffLng).toBe(-96.73)
    // The driving path is cached (JSON) + served for the map's route line.
    expect(res.routeGeometry).toEqual(ROUTE_GEOMETRY)
  })

  it('re-misses after a PUT changes the address (cache invalidation)', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const id = firstRideId()
    populateCache(id)

    // Cache hit first.
    const hit = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${id}`, {
      headers: { cookie },
    })
    expect(hit.error).toBe(null)

    // Change the dropoff address via the real PUT endpoint -> cache invalidated.
    await $fetch(`/api/put/rides/${id}`, {
      method: 'PUT',
      headers: { cookie },
      body: { dropoffDisplay: 'A Completely New Destination, TX' },
    })

    // Cache cleared -> a miss. With routing offline we get the friendly
    // route-unavailable sentinel + nulls rather than stale cached values.
    const miss = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${id}`, {
      headers: { cookie },
    })
    expect(miss.error).toBe(MISS_ERROR)
    expect(miss.distance).toBe(null)
    expect(miss.durationValue).toBe(null)
    expect(miss.pickupLat).toBe(null)
    expect(miss.routeGeometry).toBe(null)
  })
})
