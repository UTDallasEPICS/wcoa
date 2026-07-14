import { afterEach, describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import Database from 'better-sqlite3'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #14: GET /api/get/rides/estimate/:id must serve a cached
// distance/duration from the Ride record instead of hitting the Google Maps
// Directions API on every load. By populating the cache columns directly in the
// DB, a cache HIT must return the cached values with error: null — which is only
// possible once the endpoint reads and serves the cache. (Before the fix the
// endpoint ignores the cache columns, so this test fails.)
//
// Note (issue #30): the harness now sets a bogus SERVER-ONLY Maps key, so a
// cache MISS no longer returns 'Maps API Key not configured' — it gets past the
// "not configured" gate and returns a live-attempt error instead. The
// invalidation test below therefore asserts "values nulled + error present"
// rather than the exact miss string.

function db(): Database.Database {
  const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
  return new Database(dbPath)
}

interface EstimateResponse {
  duration: string | null
  distance: string | null
  durationValue: number | null
  distanceValue: number | null
  error: string | null
}

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
           cachedDurationText = ?, cachedDurationValue = ?, estimatedAt = ?
         WHERE id = ?`
      )
      .run('12.3 mi', 19795, '18 mins', 1080, new Date().toISOString(), id)
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
           cachedDurationText = NULL, cachedDurationValue = NULL, estimatedAt = NULL
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

    // With the cache cleared, we're back to a miss: the stale cached values are
    // gone (nulled) and the response carries an error. (The exact error string
    // depends on the live Directions attempt; see the #30 note at the top.)
    const miss = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${id}`, {
      headers: { cookie },
    })
    expect(miss.error).not.toBe(null)
    expect(miss.distance).toBe(null)
    expect(miss.durationValue).toBe(null)
  })
})
