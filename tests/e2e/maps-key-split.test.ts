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
// The harness (tests/global-setup.ts) sets ONLY the PUBLIC embed key
// (NUXT_PUBLIC_GOOGLE_MAPS_API_KEY, a bogus value) and leaves the server key
// UNSET. So:
//   - AFTER the fix: the endpoint reads the EMPTY server key, short-circuits at
//     the "not configured" gate, and makes NO outbound call — it returns
//     { error: 'Maps API Key not configured', ...nulls }.
//   - BEFORE the fix: the endpoint reads config.public.googleMapsApiKey, which
//     is the bogus-but-SET public value, gets PAST the gate, and attempts a
//     live Directions call — so error is NOT 'Maps API Key not configured'.
// This assertion therefore FAILS pre-fix and PASSES post-fix, and the green
// (post-fix) suite makes ZERO outbound calls — it stays fully hermetic.

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
  it('estimate endpoint reads the empty SERVER key, not the set public key', async () => {
    const cookie = await loginAs('reachtusharwani@gmail.com')
    const id = firstRideId()
    // Ensure a cache MISS so the endpoint reaches the key-gated branch.
    clearCache(id)
    touched.push(id)

    const res = await $fetch<EstimateResponse>(`/api/get/rides/estimate/${id}`, {
      headers: { cookie },
    })

    // Post-fix: server key is empty → short-circuits at the gate, no network.
    // Pre-fix: reads the SET public key → gets past the gate → NOT this string.
    expect(res.error).toBe('Maps API Key not configured')
  })
})
