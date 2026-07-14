import { afterEach, describe, expect, it } from 'vitest'
import { $fetch } from '@nuxt/test-utils/e2e'
import Database from 'better-sqlite3'
import { bootShared } from '../utils/harness'
import { loginAs } from '../utils/auth'

await bootShared()

// Issue #30: the Google Maps Directions API key must NOT ship in the client
// bundle. The estimate endpoint (server-side) must read the SERVER-ONLY key
// (runtimeConfig.googleMapsApiKey / NUXT_GOOGLE_MAPS_API_KEY), not the public
// embed key (runtimeConfig.public.googleMapsApiKey).
//
// The harness (tests/global-setup.ts) sets ONLY the server-only key
// (NUXT_GOOGLE_MAPS_API_KEY) and leaves the public key unset. So:
//   - AFTER the fix: the endpoint reads the (bogus-but-present) server key,
//     gets PAST the "not configured" gate, and attempts the live Directions
//     call — returning some OTHER error (REQUEST_DENIED / 'Failed to fetch
//     estimate' if egress is blocked), never 'Maps API Key not configured'.
//   - BEFORE the fix: the endpoint reads config.public.googleMapsApiKey, which
//     is EMPTY, so it returns { error: 'Maps API Key not configured', ...nulls }.
// This assertion therefore FAILS pre-fix and PASSES post-fix, and is robust to
// whether the test environment has outbound network to Google.

function firstRideId(): string {
  const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
  const conn = new Database(dbPath)
  try {
    const row = conn.prepare(`SELECT id FROM ride LIMIT 1`).get() as { id: string }
    return row.id
  } finally {
    conn.close()
  }
}

function clearCache(id: string): void {
  const dbPath = (process.env.DATABASE_URL ?? '').replace(/^file:/, '')
  const conn = new Database(dbPath)
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

interface EstimateResponse {
  duration: string | null
  distance: string | null
  durationValue: number | null
  distanceValue: number | null
  error: string | null
}

const touched: string[] = []
afterEach(() => {
  while (touched.length) clearCache(touched.pop()!)
})

describe('maps key split (issue #30)', () => {
  it('estimate endpoint uses the SERVER-only key, not the empty public key', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const id = firstRideId()
    // Ensure a cache MISS so the endpoint reaches the key-gated branch.
    clearCache(id)
    touched.push(id)

    const res = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${id}`, {
      headers: { cookie },
    })

    // Pre-fix (reads the empty public key) this is 'Maps API Key not configured'.
    // Post-fix (reads the set server key) it is anything but that.
    expect(res.error).not.toBe('Maps API Key not configured')
  })
})
